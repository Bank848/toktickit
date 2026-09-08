import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { StaffTicketDetailPage } from '../../src/pages/StaffTicketDetailPage';
import * as api from '../../src/api/staffTickets';

vi.mock('../../src/api/staffTickets');

const DETAIL = {
  id: 't1', ticketNo: 'TCK-2026-0001', summary: 'VPN down', description: 'Cannot connect.',
  category: { id: 1, name: 'Network' }, relatedSystem: null, status: 'OPEN',
  requestedPriority: 'HIGH', itPriority: 'HIGH', createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z', attachmentCount: 0,
  requester: { id: 'r1', displayName: 'Nattapong R.' }, owner: { id: 'owner-1', displayName: 'Jane Staff' },
  resolutionSummary: null, version: 0,
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/staff/tickets/t1']}>
      <Routes>
        <Route path="/staff/tickets/:id" element={<StaffTicketDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('StaffTicketDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValue(DETAIL);
    vi.mocked(api.fetchAssignableOwners).mockResolvedValue([
      { id: 'owner-1', displayName: 'Jane Staff', role: 'IT_STAFF' },
      { id: 'owner-2', displayName: 'John Staff', role: 'IT_STAFF' },
    ]);
    vi.mocked(api.fetchStaffComments).mockResolvedValue([]);
    vi.mocked(api.fetchStaffNotes).mockResolvedValue([]);
    vi.mocked(api.fetchStaffTicketAttachments).mockResolvedValue([]);
  });

  it('renders the ticket header fields and current owner', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('TCK-2026-0001')).toBeInTheDocument());
    expect(screen.getByText('VPN down')).toBeInTheDocument();
  });

  it('changing the status select calls updateTicketStatus with only the allowed transitions offered', async () => {
    vi.mocked(api.updateTicketStatus).mockResolvedValue({ ...DETAIL, status: 'IN_PROGRESS' });
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('Current Status')).toBeInTheDocument());

    const select = screen.getByLabelText('Current Status') as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((o) => o.value);
    // OPEN's allowed targets per specification.md §4.4: IN_PROGRESS, WAITING_FOR_REQUESTER, CANCELLED.
    expect(optionValues.sort()).toEqual(['CANCELLED', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER'].sort());

    fireEvent.change(select, { target: { value: 'IN_PROGRESS' } });
    await waitFor(() => expect(api.updateTicketStatus).toHaveBeenCalledWith('t1', 'IN_PROGRESS'));
  });

  it('disables the status select with a tooltip when the ticket is NEW and unowned (BR-15)', async () => {
    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValue({ ...DETAIL, status: 'NEW', owner: null });
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('Current Status')).toBeDisabled());
    expect(screen.getByTitle('Assign an owner first')).toBeInTheDocument();
  });

  it('also disables the status select with a tooltip when the ticket is CANCELLED (BR-19, matching priorityLocked)', async () => {
    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValue({ ...DETAIL, status: 'CANCELLED', owner: { id: 'owner-1', displayName: 'Jane Staff' } });
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('Current Status')).toBeDisabled());
    // getByTitle would match ambiguously here since priorityLocked also fires the same tooltip
    // on the IT Priority select for this same terminal status -- scope to the status select itself.
    expect(screen.getByLabelText('Current Status')).toHaveAttribute('title', 'Locked: ticket is Closed/Cancelled');
  });

  it('claiming an unowned NEW ticket calls updateTicketOwner and the returned ticket flips the status badge to Open (UI-06/AC-17)', async () => {
    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValue({ ...DETAIL, status: 'NEW', owner: null });
    vi.mocked(api.updateTicketOwner).mockResolvedValue({ ...DETAIL, status: 'OPEN', owner: { id: 'owner-1', displayName: 'Jane Staff' } });

    renderPage();
    await waitFor(() => expect(screen.getByLabelText('Ticket Owner')).toBeInTheDocument());

    // Pre-claim: status select is disabled per BR-15's "assign an owner first" rule.
    expect(screen.getByLabelText('Current Status')).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Ticket Owner'), { target: { value: 'owner-1' } });

    await waitFor(() => expect(api.updateTicketOwner).toHaveBeenCalledWith('t1', 'owner-1'));
    // The claim response updates the page's ticket state, which flips the visible status badge
    // to Open and un-disables the status select -- this is the actual claim *flow*, not just a
    // check that the Owner control exists.
    await waitFor(() => expect(screen.getByLabelText('Current Status')).not.toBeDisabled());
    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it('disables the IT Priority select with a tooltip when the ticket is Closed', async () => {
    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValue({ ...DETAIL, status: 'CLOSED' });
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('IT Priority')).toBeDisabled());
    // Same ambiguity as above -- CLOSED also locks the status select with the identical tooltip --
    // so scope the assertion to the IT Priority select itself.
    expect(screen.getByLabelText('IT Priority')).toHaveAttribute('title', 'Locked: ticket is Closed/Cancelled');
  });

  it('renders Internal Notes in a visually distinct section labelled staff-only', async () => {
    vi.mocked(api.fetchStaffNotes).mockResolvedValue([
      { id: 'n1', ticketId: 't1', body: 'Escalated', author: { id: 's1', displayName: 'Jane Staff' }, authorRole: 'IT_STAFF', createdAt: '2026-09-01T00:00:00Z' },
    ]);
    renderPage();
    await waitFor(() => expect(screen.getByText('Escalated')).toBeInTheDocument());
    expect(screen.getByText('Internal — visible only to IT Staff and Administrators')).toBeInTheDocument();
  });

  it('posting a Public Comment calls postStaffComment and appends it to the list', async () => {
    vi.mocked(api.postStaffComment).mockResolvedValue({
      id: 'c1', ticketId: 't1', body: 'Looking into it', author: { id: 's1', displayName: 'Jane Staff' },
      authorRole: 'IT_STAFF', createdAt: '2026-09-01T00:00:00Z',
    });
    renderPage();
    await waitFor(() => expect(screen.getByPlaceholderText('Type your comment here…')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText('Type your comment here…'), { target: { value: 'Looking into it' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post Comment' }));

    await waitFor(() => expect(api.postStaffComment).toHaveBeenCalledWith('t1', 'Looking into it'));
    await waitFor(() => expect(screen.getByText('Looking into it')).toBeInTheDocument());
  });
});
