import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../../src/App';
import * as authApi from '../../src/api/auth';
import * as dashboardApi from '../../src/api/dashboard';
import * as ticketsApi from '../../src/api/tickets';
import * as lookupsApi from '../../src/api/lookups';
import * as staffTicketsApi from '../../src/api/staffTickets';

const ZERO_STATUS = { NEW: 0, OPEN: 0, IN_PROGRESS: 0, WAITING_FOR_REQUESTER: 0, RESOLVED: 0, CLOSED: 0, REOPENED: 0, CANCELLED: 0 };

function ticketRow(id: string, status: string) {
  return {
    id, ticketNo: `TKT-2026-${id}`, summary: `Ticket ${id}`, category: { id: 1, name: 'Network' },
    status, requestedPriority: 'MEDIUM', itPriority: 'MEDIUM', createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z', attachmentCount: 0,
  };
}

describe('Dashboard card to list drill-down (FR-10)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(lookupsApi, 'fetchCategories').mockResolvedValue([]);
    vi.spyOn(staffTicketsApi, 'fetchAssignableOwners').mockResolvedValue([]);
  });

  it('Requester: clicking a card opens My Tickets filtered by that status, and the server total equals the card count', async () => {
    vi.spyOn(authApi, 'fetchMe').mockResolvedValue({
      id: 'r1', email: 'r@toktickit.local', displayName: 'Req', role: 'REQUESTER', mustChangePassword: false,
    });
    vi.spyOn(dashboardApi, 'fetchRequesterDashboard').mockResolvedValue({
      statusCounts: { ...ZERO_STATUS, RESOLVED: 2 }, recentTickets: [],
    });
    const listSpy = vi.spyOn(ticketsApi, 'fetchTickets').mockImplementation(async (q) => {
      const rows = (q?.status ?? []).includes('RESOLVED') ? [ticketRow('1', 'RESOLVED'), ticketRow('2', 'RESOLVED')] : [];
      return { data: rows, meta: { page: 1, pageSize: 10, total: rows.length, totalPages: 1 } };
    });

    render(<MemoryRouter initialEntries={['/dashboard']}><App /></MemoryRouter>);
    await userEvent.click(await screen.findByRole('link', { name: /^resolved\b.*2/i }));
    await waitFor(() => expect(listSpy).toHaveBeenCalledWith(expect.objectContaining({ status: ['RESOLVED'] })));
    await waitFor(() => screen.getByRole('heading', { name: /my tickets/i }));
    // The total the list endpoint reports for the linked filter equals the number on the card.
    const last = listSpy.mock.results[listSpy.mock.results.length - 1].value as Promise<{ meta: { total: number } }>;
    expect((await last).meta.total).toBe(2);
  });

  it('My Tickets re-reads the URL filter when the query string changes on an already mounted page', async () => {
    vi.spyOn(authApi, 'fetchMe').mockResolvedValue({
      id: 'r1', email: 'r@toktickit.local', displayName: 'Req', role: 'REQUESTER', mustChangePassword: false,
    });
    const listSpy = vi.spyOn(ticketsApi, 'fetchTickets').mockResolvedValue({
      data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
    });
    const { MyTicketsPage } = await import('../../src/pages/MyTicketsPage');
    const { Link, Routes, Route } = await import('react-router-dom');
    render(
      <MemoryRouter initialEntries={['/tickets?status=OPEN']}>
        <Link to="/tickets?status=CLOSED">go closed</Link>
        <Link to="/tickets">go all</Link>
        <Routes><Route path="/tickets" element={<MyTicketsPage />} /></Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(listSpy).toHaveBeenLastCalledWith(expect.objectContaining({ status: ['OPEN'] })));
    await userEvent.click(screen.getByRole('link', { name: 'go closed' }));
    await waitFor(() => expect(listSpy).toHaveBeenLastCalledWith(expect.objectContaining({ status: ['CLOSED'] })));
    await userEvent.click(screen.getByRole('link', { name: 'go all' }));
    await waitFor(() => expect(listSpy).toHaveBeenLastCalledWith(expect.objectContaining({ status: [] })));
  });

  it('Ticket Queue re-reads status, itPriority and ownerId when the query string changes on a mounted page', async () => {
    const listSpy = vi.spyOn(staffTicketsApi, 'fetchStaffTickets').mockResolvedValue({
      data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
    });
    const { StaffTicketQueuePage } = await import('../../src/pages/StaffTicketQueuePage');
    const { Link, Routes, Route } = await import('react-router-dom');
    render(
      <MemoryRouter initialEntries={['/staff/tickets?status=NEW']}>
        <Link to="/staff/tickets?itPriority=URGENT">go urgent</Link>
        <Link to="/staff/tickets?ownerId=unassigned">go unassigned</Link>
        <Routes><Route path="/staff/tickets" element={<StaffTicketQueuePage />} /></Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(listSpy).toHaveBeenLastCalledWith(expect.objectContaining({ status: ['NEW'], itPriority: null })));
    await userEvent.click(screen.getByRole('link', { name: 'go urgent' }));
    await waitFor(() =>
      expect(listSpy).toHaveBeenLastCalledWith(expect.objectContaining({ status: [], itPriority: 'URGENT', ownerId: null })),
    );
    await userEvent.click(screen.getByRole('link', { name: 'go unassigned' }));
    await waitFor(() =>
      expect(listSpy).toHaveBeenLastCalledWith(expect.objectContaining({ itPriority: null, ownerId: 'unassigned' })),
    );
  });
});
