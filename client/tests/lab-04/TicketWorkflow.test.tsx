import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { StaffTicketDetailPage } from '../../src/pages/StaffTicketDetailPage';
import * as staffTicketsApi from '../../src/api/staffTickets';
import * as staffActionsApi from '../../src/api/staffActions';
import { ApiError } from '../../src/api/tickets';

const TICKET_ID = 'tkt-1';

const STAFF_DETAIL = {
  id: TICKET_ID, ticketNo: 'TCK-2026-0001', summary: 'VPN down', description: 'Cannot connect.',
  category: { id: 1, name: 'Network' }, relatedSystem: null, status: 'IN_PROGRESS',
  requestedPriority: 'HIGH', itPriority: 'HIGH', createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z', attachmentCount: 0,
  requester: { id: 'r1', displayName: 'Nattapong R.' }, owner: { id: 'owner-1', displayName: 'Jane Staff' },
  resolutionSummary: null, version: 0,
};

const DIRECTED_MESSAGE = 'This ticket cannot be marked Resolved yet \u2014 record an Action Taken first.';

function mockPage() {
  vi.restoreAllMocks();
  vi.spyOn(staffTicketsApi, 'fetchStaffTicketDetail').mockResolvedValue(STAFF_DETAIL as never);
  vi.spyOn(staffTicketsApi, 'fetchAssignableOwners').mockResolvedValue([]);
  vi.spyOn(staffTicketsApi, 'fetchStaffComments').mockResolvedValue([]);
  vi.spyOn(staffTicketsApi, 'fetchStaffNotes').mockResolvedValue([]);
  vi.spyOn(staffTicketsApi, 'fetchStaffTicketAttachments').mockResolvedValue([]);
  vi.spyOn(staffActionsApi, 'fetchStaffActions').mockResolvedValue([]);
}

async function changeStatusToResolved() {
  render(
    <MemoryRouter initialEntries={[`/staff/tickets/${TICKET_ID}`]}>
      <Routes>
        <Route path="/staff/tickets/:id" element={<StaffTicketDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
  const select = await screen.findByLabelText('Current Status');
  fireEvent.change(select, { target: { value: 'RESOLVED' } });
}

describe('Staff status change: resolution gate message (FR-06, ui-spec section 4)', () => {
  beforeEach(mockPage);

  it('CMP-16 shows the directed message, not the raw error, for RESOLUTION_REQUIRES_ACTION_TAKEN', async () => {
    vi.spyOn(staffTicketsApi, 'updateTicketStatus').mockRejectedValue(
      new ApiError('Record at least one Action Taken before resolving this ticket', 409, [], 'RESOLUTION_REQUIRES_ACTION_TAKEN'),
    );
    await changeStatusToResolved();
    await waitFor(() => expect(screen.getByText(DIRECTED_MESSAGE)).toBeInTheDocument());
    expect(screen.queryByText(/RESOLUTION_REQUIRES_ACTION_TAKEN/)).not.toBeInTheDocument();
    expect(screen.queryByText(/before resolving this ticket/i)).not.toBeInTheDocument();
    // The ticket keeps its previous status.
    expect(screen.getByTestId('ticket-status-badge')).toHaveTextContent(/in progress/i);
  });

  it('CMP-17 a different 409 whose text mentions an action and resolving does not show the directed message', async () => {
    vi.spyOn(staffTicketsApi, 'updateTicketStatus').mockRejectedValue(
      new ApiError('Cannot resolve: the action you requested conflicts', 409, [], 'INVALID_STATUS_TRANSITION'),
    );
    await changeStatusToResolved();
    await waitFor(() => expect(screen.getByText('Cannot resolve: the action you requested conflicts')).toBeInTheDocument());
    expect(screen.queryByText(DIRECTED_MESSAGE)).not.toBeInTheDocument();
  });

  it('CMP-18 an unrelated status failure keeps the existing fallback message', async () => {
    vi.spyOn(staffTicketsApi, 'updateTicketStatus').mockRejectedValue(new Error('network down'));
    await changeStatusToResolved();
    await waitFor(() => expect(screen.getByText('Failed to update status.')).toBeInTheDocument());
    expect(screen.queryByText(DIRECTED_MESSAGE)).not.toBeInTheDocument();
  });
});
