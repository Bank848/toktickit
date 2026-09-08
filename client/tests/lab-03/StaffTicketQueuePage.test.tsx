import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StaffTicketQueuePage } from '../../src/pages/StaffTicketQueuePage';
import * as staffTicketsApi from '../../src/api/staffTickets';

vi.mock('../../src/api/staffTickets');

describe('StaffTicketQueuePage', () => {
  beforeEach(() => {
    // Clear call history between tests -- fetchStaffTickets/fetchAssignableOwners are module-level
    // vi.mock() doubles, so without this, call counts (asserted with toHaveBeenCalledTimes below)
    // would accumulate across tests in this file (mirrors the vi.restoreAllMocks() beforeEach used
    // throughout tests/lab-02/MyTickets.test.tsx for the same reason).
    vi.clearAllMocks();
    vi.mocked(staffTicketsApi.fetchAssignableOwners).mockResolvedValue([
      { id: 'owner-1', displayName: 'Jane Staff', role: 'IT_STAFF' },
    ]);
  });

  it('renders every returned ticket, including its owner column', async () => {
    vi.mocked(staffTicketsApi.fetchStaffTickets).mockResolvedValue({
      data: [
        {
          id: 't1', ticketNo: 'TCK-2026-0001', summary: 'VPN down', category: { id: 1, name: 'Network' },
          status: 'OPEN', requestedPriority: 'HIGH', itPriority: 'HIGH', createdAt: '2026-09-01T00:00:00Z',
          updatedAt: '2026-09-01T00:00:00Z', attachmentCount: 0, owner: { id: 'owner-1', displayName: 'Jane Staff' },
        },
      ],
      meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });

    render(
      <MemoryRouter>
        <StaffTicketQueuePage />
      </MemoryRouter>
    );

    // The ticket number and owner name each render once in the desktop table and once in the
    // mobile card list (both are always in the DOM -- see the UI-05 test below) -- getAllByText
    // instead of getByText, same as tests/lab-02/MyTickets.test.tsx's findAllByText(TICKET.summary).
    await waitFor(() => expect(screen.getAllByText('TCK-2026-0001').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Jane Staff').length).toBeGreaterThan(0);
  });

  it('shows "Unassigned" for a null owner', async () => {
    vi.mocked(staffTicketsApi.fetchStaffTickets).mockResolvedValue({
      data: [
        {
          id: 't2', ticketNo: 'TCK-2026-0002', summary: 'Printer jam', category: { id: 2, name: 'Hardware' },
          status: 'NEW', requestedPriority: 'LOW', itPriority: 'LOW', createdAt: '2026-09-01T00:00:00Z',
          updatedAt: '2026-09-01T00:00:00Z', attachmentCount: 0, owner: null,
        },
      ],
      meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });

    render(
      <MemoryRouter>
        <StaffTicketQueuePage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Unassigned')).toBeInTheDocument());
  });

  it('shows the empty-queue message when there are genuinely zero tickets', async () => {
    vi.mocked(staffTicketsApi.fetchStaffTickets).mockResolvedValue({
      data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
    });

    render(
      <MemoryRouter>
        <StaffTicketQueuePage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('No tickets in the queue yet')).toBeInTheDocument());
  });

  it('re-fetches when the itPriority filter changes, and Clear filters resets the query and disables itself (UI-04)', async () => {
    vi.mocked(staffTicketsApi.fetchStaffTickets).mockResolvedValue({
      data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
    });

    render(
      <MemoryRouter>
        <StaffTicketQueuePage />
      </MemoryRouter>
    );

    await waitFor(() => expect(staffTicketsApi.fetchStaffTickets).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('IT Priority'), { target: { value: 'HIGH' } });

    await waitFor(() =>
      expect(staffTicketsApi.fetchStaffTickets).toHaveBeenLastCalledWith(expect.objectContaining({ itPriority: 'HIGH' })),
    );
    // With an active filter and zero rows, the "no tickets match your filters" empty state adds
    // its own "Clear filters" button alongside the toolbar's -- same dual-button shape as
    // MyTicketsPage, which is why tests/lab-02/MyTickets.test.tsx asserts over
    // getAllByRole(...) here instead of getByRole(...).
    for (const button of screen.getAllByRole('button', { name: 'Clear filters' })) {
      expect(button).not.toBeDisabled();
    }

    fireEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]);

    await waitFor(() =>
      expect(staffTicketsApi.fetchStaffTickets).toHaveBeenLastCalledWith(expect.objectContaining({ itPriority: null })),
    );
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeDisabled();
  });

  it('renders both the desktop table and a mobile card list for the same tickets (UI-05, dual-DOM responsiveness)', async () => {
    vi.mocked(staffTicketsApi.fetchStaffTickets).mockResolvedValue({
      data: [
        {
          id: 't1', ticketNo: 'TCK-2026-0001', summary: 'VPN down', category: { id: 1, name: 'Network' },
          status: 'OPEN', requestedPriority: 'HIGH', itPriority: 'HIGH', createdAt: '2026-09-01T00:00:00Z',
          updatedAt: '2026-09-01T00:00:00Z', attachmentCount: 0, owner: null,
        },
      ],
      meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });

    const { container } = render(
      <MemoryRouter>
        <StaffTicketQueuePage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getAllByText('TCK-2026-0001').length).toBeGreaterThan(0));

    // The desktop table is hidden below md via Bootstrap's `d-none d-md-block`; the card list
    // is shown only below md via `d-md-none` -- this dual-DOM pair is what actually produces
    // "stacked cards, no horizontal scroll" at a sub-768px viewport (pixel-for-pixel confirmed
    // in the mobile Playwright project, e2e/lab-03/staff-ticket-flow.spec.ts's
    // assertNoHorizontalOverflow calls -- jsdom has no real layout engine to assert overflow
    // against directly, so this test instead pins the markup structure that overflow depends on).
    const desktopTable = container.querySelector('.d-none.d-md-block table');
    const mobileCards = container.querySelector('.d-md-none');
    expect(desktopTable).not.toBeNull();
    expect(mobileCards).not.toBeNull();
    expect(mobileCards?.textContent).toContain('TCK-2026-0001');
  });
});
