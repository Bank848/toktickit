import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StaffDashboardPage } from '../../src/pages/StaffDashboardPage';
import { AuthContext } from '../../src/context/AuthContext';
import * as dashboardApi from '../../src/api/dashboard';
import type { StaffDashboardDto } from '../../src/api/dashboard';

function dashboard(overrides: Partial<StaffDashboardDto> = {}): StaffDashboardDto {
  return {
    unassignedCount: 0, ownedByMeCount: 0,
    statusCounts: { NEW: 0, OPEN: 0, IN_PROGRESS: 0, WAITING_FOR_REQUESTER: 0, RESOLVED: 0, CLOSED: 0, REOPENED: 0, CANCELLED: 0 },
    priorityCounts: { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 },
    recentTickets: [],
    ...overrides,
  };
}

function renderAs(role: 'IT_STAFF' | 'ADMINISTRATOR') {
  render(
    <AuthContext.Provider value={{
      currentUser: { id: 'staff-1', displayName: 'Pakorn W.', email: 'itstaff2@toktickit.local', role, mustChangePassword: false },
      isLoading: false, setCurrentUser: vi.fn(), logout: vi.fn(),
    }}>
      <MemoryRouter><StaffDashboardPage /></MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('StaffDashboardPage', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('renders New/Open/In Progress/Waiting/assigned-to-me metric cards for IT Staff', async () => {
    vi.spyOn(dashboardApi, 'fetchStaffDashboard').mockResolvedValue(dashboard({ ownedByMeCount: 3 }));
    renderAs('IT_STAFF');
    await waitFor(() => expect(screen.getByText(/assigned to me/i)).toBeInTheDocument());
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('FR-08: renders IT Priority metric cards (Low/Medium/High/Urgent), not just status cards', async () => {
    vi.spyOn(dashboardApi, 'fetchStaffDashboard').mockResolvedValue(
      dashboard({ priorityCounts: { LOW: 1, MEDIUM: 2, HIGH: 0, URGENT: 4 } }),
    );
    renderAs('IT_STAFF');
    await waitFor(() => screen.getByText(/assigned to me/i));
    expect(screen.getByText(/^urgent$/i)).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('does not render the user-accounts-by-role card for an IT Staff caller (userCounts absent)', async () => {
    vi.spyOn(dashboardApi, 'fetchStaffDashboard').mockResolvedValue(dashboard());
    renderAs('IT_STAFF');
    await waitFor(() => screen.getByText(/assigned to me/i));
    expect(screen.queryByText(/accounts by role/i)).not.toBeInTheDocument();
  });

  it('renders the user-accounts-by-role card for an Administrator caller when userCounts is present (FR-09)', async () => {
    vi.spyOn(dashboardApi, 'fetchStaffDashboard').mockResolvedValue(
      dashboard({ userCounts: { REQUESTER: 5, IT_STAFF: 3, ADMINISTRATOR: 1 } }),
    );
    renderAs('ADMINISTRATOR');
    await waitFor(() => expect(screen.getByText(/accounts by role/i)).toBeInTheDocument());
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('FR-10: status/priority/assigned-to-me/unassigned cards each link to the Ticket Queue filtered to match', async () => {
    vi.spyOn(dashboardApi, 'fetchStaffDashboard').mockResolvedValue(dashboard());
    renderAs('IT_STAFF');
    await waitFor(() => screen.getByText(/assigned to me/i));
    // The count is rendered as visible, non-aria-hidden text inside each card link (unlike
    // RequesterDashboardPage's cards), so the accessible name is "<Label> <count>", e.g. "New 0" —
    // matched with a leading word-boundary anchor rather than an exact `^label$` match.
    expect(screen.getByRole('link', { name: /^new\b/i })).toHaveAttribute('href', '/staff/tickets?status=NEW');
    expect(screen.getByRole('link', { name: /^urgent\b/i })).toHaveAttribute('href', '/staff/tickets?itPriority=URGENT');
    expect(screen.getByRole('link', { name: /assigned to me/i })).toHaveAttribute('href', '/staff/tickets?ownerId=staff-1');
    expect(screen.getByRole('link', { name: /^unassigned\b/i })).toHaveAttribute('href', '/staff/tickets?ownerId=unassigned');
  });
});
