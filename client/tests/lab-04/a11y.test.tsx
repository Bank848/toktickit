import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import { RequesterDashboardPage } from '../../src/pages/RequesterDashboardPage';
import { StaffDashboardPage } from '../../src/pages/StaffDashboardPage';
import { ActionsTakenSection } from '../../src/components/ActionsTakenSection';
import { AuthContext } from '../../src/context/AuthContext';
import * as dashboardApi from '../../src/api/dashboard';
import * as staffActionsApi from '../../src/api/staffActions';

// CMP-33 (specification section 10): an axe-core run over both dashboards and the Actions Taken
// form. jsdom has no layout, so the colour-contrast rule cannot run here (it is checked by eye in the
// E2E-07 screenshots), and the page-level `region` rule is off because each component renders without
// the app shell's landmarks. Every other rule runs; the test fails on any serious or critical result.
async function seriousViolations(container: HTMLElement) {
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`);
}

const ZERO_STATUS = { NEW: 0, OPEN: 2, IN_PROGRESS: 0, WAITING_FOR_REQUESTER: 1, RESOLVED: 0, CLOSED: 0, REOPENED: 0, CANCELLED: 0 };

describe('accessibility of the Lab 4 screens (CMP-33)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('the Requester Dashboard has no serious violation and each card name includes its count', async () => {
    vi.spyOn(dashboardApi, 'fetchRequesterDashboard').mockResolvedValue({
      statusCounts: ZERO_STATUS,
      recentTickets: [{ id: 't-1', ticketNo: 'TKT-2025-00099', summary: 'VPN issue', status: 'OPEN', updatedAt: '2026-09-20T10:00:00.000Z' }],
    });
    const { container } = render(<MemoryRouter><RequesterDashboardPage /></MemoryRouter>);
    await waitFor(() => screen.getByText('TKT-2025-00099'));
    expect(screen.getByRole('link', { name: 'Open 2' })).toBeInTheDocument();
    expect(await seriousViolations(container)).toEqual([]);
  });

  it('the Administrator Dashboard has no serious violation', async () => {
    vi.spyOn(dashboardApi, 'fetchStaffDashboard').mockResolvedValue({
      unassignedCount: 1, ownedByMeCount: 3, statusCounts: ZERO_STATUS,
      priorityCounts: { LOW: 1, MEDIUM: 2, HIGH: 0, URGENT: 4 },
      userCounts: { REQUESTER: 5, IT_STAFF: 3, ADMINISTRATOR: 1 },
      recentTickets: [{ id: 't-1', ticketNo: 'TKT-2025-00099', summary: 'VPN issue', status: 'OPEN', updatedAt: '2026-09-20T10:00:00.000Z' }],
    });
    const { container } = render(
      <AuthContext.Provider
        value={{
          currentUser: { id: 'admin-1', displayName: 'System Admin', email: 'admin@toktickit.local', role: 'ADMINISTRATOR', mustChangePassword: false },
          isLoading: false, setCurrentUser: vi.fn(), logout: vi.fn(),
        }}
      >
        <MemoryRouter><StaffDashboardPage /></MemoryRouter>
      </AuthContext.Provider>,
    );
    await waitFor(() => screen.getByText('TKT-2025-00099'));
    expect(await seriousViolations(container)).toEqual([]);
  });

  it('the dashboard error alert has no serious violation', async () => {
    vi.spyOn(dashboardApi, 'fetchRequesterDashboard').mockRejectedValue(new Error('boom'));
    const { container } = render(<MemoryRouter><RequesterDashboardPage /></MemoryRouter>);
    await waitFor(() => screen.getByRole('alert'));
    expect(await seriousViolations(container)).toEqual([]);
  });

  it('the open Actions Taken form has a label on every field and no serious violation', async () => {
    vi.spyOn(staffActionsApi, 'fetchStaffActions').mockResolvedValue([]);
    const { container } = render(<ActionsTakenSection ticketId="tkt-1" ticketLocked={false} />);
    await waitFor(() => screen.getByText('No Actions Taken yet.'));
    fireEvent.click(screen.getByRole('button', { name: /record action taken/i }));
    await waitFor(() => screen.getByLabelText(/^description/i));
    fireEvent.click(screen.getByLabelText(/follow-up required/i));
    expect(screen.getByLabelText(/^description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^result/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/follow-up note/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/attachment notes/i)).toBeInTheDocument();
    expect(await seriousViolations(container)).toEqual([]);
  });
});
