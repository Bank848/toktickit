import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RequesterDashboardPage } from '../../src/pages/RequesterDashboardPage';
import * as dashboardApi from '../../src/api/dashboard';
import type { RequesterDashboardDto } from '../../src/api/dashboard';

function dashboard(overrides: Partial<RequesterDashboardDto> = {}): RequesterDashboardDto {
  return {
    statusCounts: { NEW: 0, OPEN: 0, IN_PROGRESS: 0, WAITING_FOR_REQUESTER: 0, RESOLVED: 0, CLOSED: 0, REOPENED: 0, CANCELLED: 0 },
    recentTickets: [],
    ...overrides,
  };
}

describe('RequesterDashboardPage', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('renders zero-value metric cards, not omitted ones, for a fresh Requester (AC-12)', async () => {
    vi.spyOn(dashboardApi, 'fetchRequesterDashboard').mockResolvedValue(dashboard());
    render(<MemoryRouter><RequesterDashboardPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/open/i)).toBeInTheDocument());
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText(/no recent tickets/i)).toBeInTheDocument();
  });

  it('renders the four labsheet §8.2 metric cards with real counts and a recent-Tickets list', async () => {
    vi.spyOn(dashboardApi, 'fetchRequesterDashboard').mockResolvedValue(
      dashboard({
        statusCounts: { NEW: 0, OPEN: 2, IN_PROGRESS: 0, WAITING_FOR_REQUESTER: 1, RESOLVED: 3, CLOSED: 5, REOPENED: 0, CANCELLED: 0 },
        recentTickets: [{ id: 't-1', ticketNo: 'TKT-2025-00099', summary: 'VPN issue', status: 'OPEN', updatedAt: '2026-09-20T10:00:00.000Z' }],
      }),
    );
    render(<MemoryRouter><RequesterDashboardPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('TKT-2025-00099')).toBeInTheDocument());
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /create ticket/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view my tickets/i })).toBeInTheDocument();
  });

  it('FR-10: each metric card links to My Tickets filtered by that exact status', async () => {
    vi.spyOn(dashboardApi, 'fetchRequesterDashboard').mockResolvedValue(dashboard({ statusCounts: { ...dashboard().statusCounts, OPEN: 2 } }));
    render(<MemoryRouter><RequesterDashboardPage /></MemoryRouter>);
    await waitFor(() => screen.getByText(/open/i));
    expect(screen.getByRole('link', { name: /^open\b/i })).toHaveAttribute('href', '/tickets?status=OPEN');
    expect(screen.getByRole('link', { name: /^waiting\b/i })).toHaveAttribute('href', '/tickets?status=WAITING_FOR_REQUESTER');
    expect(screen.getByRole('link', { name: /^resolved\b/i })).toHaveAttribute('href', '/tickets?status=RESOLVED');
    expect(screen.getByRole('link', { name: /^closed\b/i })).toHaveAttribute('href', '/tickets?status=CLOSED');
  });

  it('shows an inline error with Retry when the dashboard fetch fails', async () => {
    const fetchSpy = vi.spyOn(dashboardApi, 'fetchRequesterDashboard')
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce(dashboard());
    render(<MemoryRouter><RequesterDashboardPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    screen.getByRole('button', { name: /retry/i }).click();
    await waitFor(() => expect(screen.getByText(/no recent tickets/i)).toBeInTheDocument());
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
