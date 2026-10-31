import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../../src/App';
import { HOME_ROUTE } from '../../src/lib/homeRoute';
import * as authApi from '../../src/api/auth';
import * as dashboardApi from '../../src/api/dashboard';
import * as ticketsApi from '../../src/api/tickets';
import * as lookupsApi from '../../src/api/lookups';
import * as staffTicketsApi from '../../src/api/staffTickets';
import type { CurrentUser } from '../../src/api/auth';

type Role = CurrentUser['role'];

function user(role: Role, mustChangePassword = false): CurrentUser {
  return { id: `u-${role}`, email: `${role}@toktickit.local`, displayName: 'Tester', role, mustChangePassword };
}

const ZERO_STATUS = { NEW: 0, OPEN: 0, IN_PROGRESS: 0, WAITING_FOR_REQUESTER: 0, RESOLVED: 0, CLOSED: 0, REOPENED: 0, CANCELLED: 0 };

function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('Navigation and post-login landing (ui-spec section 8)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(dashboardApi, 'fetchRequesterDashboard').mockResolvedValue({ statusCounts: { ...ZERO_STATUS }, recentTickets: [] });
    vi.spyOn(dashboardApi, 'fetchStaffDashboard').mockResolvedValue({
      unassignedCount: 0, ownedByMeCount: 0, statusCounts: { ...ZERO_STATUS },
      priorityCounts: { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 }, recentTickets: [],
    });
    vi.spyOn(lookupsApi, 'fetchCategories').mockResolvedValue([]);
    vi.spyOn(ticketsApi, 'fetchTickets').mockResolvedValue({ data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 1 } });
    vi.spyOn(staffTicketsApi, 'fetchStaffTickets').mockResolvedValue({ data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 1 } });
    vi.spyOn(staffTicketsApi, 'fetchAssignableOwners').mockResolvedValue([]);
  });

  it('HOME_ROUTE is the single landing map from the section 8 table', () => {
    expect(HOME_ROUTE).toEqual({ REQUESTER: '/dashboard', IT_STAFF: '/staff/dashboard', ADMINISTRATOR: '/staff/dashboard' });
  });

  it('Requester: Dashboard entry sits before My Tickets and the Requester dashboard is active', async () => {
    vi.spyOn(authApi, 'fetchMe').mockResolvedValue(user('REQUESTER'));
    renderApp('/dashboard');
    await waitFor(() => screen.getByRole('heading', { name: /my dashboard/i }));
    const nav = screen.getByRole('navigation', { name: /main navigation/i });
    const labels = Array.from(nav.querySelectorAll('a.nav-link')).map((a) => a.textContent);
    expect(labels).toEqual(['Dashboard', 'My Tickets', 'Create Ticket']);
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
  });

  it('IT Staff: Dashboard entry sits before the Ticket Queue entry', async () => {
    vi.spyOn(authApi, 'fetchMe').mockResolvedValue(user('IT_STAFF'));
    renderApp('/staff/dashboard');
    await waitFor(() => screen.getByRole('heading', { name: /it staff dashboard/i }));
    const nav = screen.getByRole('navigation', { name: /main navigation/i });
    const labels = Array.from(nav.querySelectorAll('a.nav-link')).map((a) => a.textContent);
    expect(labels).toEqual(['Dashboard', 'My Queue']);
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
  });

  it('Administrator: Dashboard entry sits before User Management and the heading says Administrator', async () => {
    vi.spyOn(authApi, 'fetchMe').mockResolvedValue(user('ADMINISTRATOR'));
    renderApp('/staff/dashboard');
    await waitFor(() => screen.getByRole('heading', { name: /administrator dashboard/i }));
    const nav = screen.getByRole('navigation', { name: /main navigation/i });
    const labels = Array.from(nav.querySelectorAll('a.nav-link')).map((a) => a.textContent);
    expect(labels).toEqual(['Dashboard', 'Users']);
  });

  it.each([
    ['REQUESTER', /my dashboard/i],
    ['IT_STAFF', /it staff dashboard/i],
    ['ADMINISTRATOR', /administrator dashboard/i],
  ] as const)('the root path lands a %s on their own dashboard', async (role, heading) => {
    vi.spyOn(authApi, 'fetchMe').mockResolvedValue(user(role));
    renderApp('/');
    await waitFor(() => screen.getByRole('heading', { name: heading }));
  });

  it('a Requester opening the staff dashboard is redirected to the Requester dashboard', async () => {
    vi.spyOn(authApi, 'fetchMe').mockResolvedValue(user('REQUESTER'));
    renderApp('/staff/dashboard');
    await waitFor(() => screen.getByRole('heading', { name: /my dashboard/i }));
    expect(dashboardApi.fetchStaffDashboard).not.toHaveBeenCalled();
  });

  it('IT Staff and Administrator opening /dashboard are redirected to the staff dashboard', async () => {
    vi.spyOn(authApi, 'fetchMe').mockResolvedValue(user('IT_STAFF'));
    const first = renderApp('/dashboard');
    await waitFor(() => screen.getByRole('heading', { name: /it staff dashboard/i }));
    first.unmount();

    vi.spyOn(authApi, 'fetchMe').mockResolvedValue(user('ADMINISTRATOR'));
    renderApp('/dashboard');
    await waitFor(() => screen.getByRole('heading', { name: /administrator dashboard/i }));
    expect(dashboardApi.fetchRequesterDashboard).not.toHaveBeenCalled();
  });

  it('LoginPage lands each role on its own dashboard', async () => {
    for (const [role, heading] of [
      ['REQUESTER', /my dashboard/i],
      ['IT_STAFF', /it staff dashboard/i],
      ['ADMINISTRATOR', /administrator dashboard/i],
    ] as const) {
      vi.spyOn(authApi, 'fetchMe').mockRejectedValue(new Error('Not authenticated'));
      vi.spyOn(authApi, 'login').mockResolvedValue(user(role));
      const view = renderApp('/login');
      // eslint-disable-next-line no-await-in-loop
      await userEvent.type(await screen.findByLabelText(/email address/i), 'someone@toktickit.local');
      // eslint-disable-next-line no-await-in-loop
      await userEvent.type(screen.getByLabelText(/^password$/i), 'DevPass123!');
      // eslint-disable-next-line no-await-in-loop
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
      // eslint-disable-next-line no-await-in-loop
      await waitFor(() => screen.getByRole('heading', { name: heading }));
      view.unmount();
    }
  });

  it('ChangePasswordPage lands the role on its own dashboard after success', async () => {
    vi.spyOn(authApi, 'fetchMe').mockResolvedValue(user('IT_STAFF', true));
    vi.spyOn(authApi, 'changePassword').mockResolvedValue(user('IT_STAFF'));
    renderApp('/change-password');
    await userEvent.type(await screen.findByLabelText(/current \(temporary\) password/i), 'DevPass123!');
    await userEvent.type(screen.getByLabelText(/^new password$/i), 'NewStrong1!');
    await userEvent.type(screen.getByLabelText(/confirm new password/i), 'NewStrong1!');
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    await waitFor(() => screen.getByRole('heading', { name: /it staff dashboard/i }));
  });

  it('a user who must change the password still goes to /change-password first', async () => {
    vi.spyOn(authApi, 'fetchMe').mockResolvedValue(user('REQUESTER', true));
    renderApp('/dashboard');
    await waitFor(() => screen.getByLabelText(/current \(temporary\) password/i));
    expect(dashboardApi.fetchRequesterDashboard).not.toHaveBeenCalled();
  });
});
