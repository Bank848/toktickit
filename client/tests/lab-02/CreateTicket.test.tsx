import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { RequesterProvider } from '../../src/context/RequesterContext';
import { CreateTicketPage } from '../../src/pages/CreateTicketPage';
import * as lookupsApi from '../../src/api/lookups';
import * as ticketsApi from '../../src/api/tickets';
import * as attachmentsApi from '../../src/api/attachments';
import { ApiError } from '../../src/api/tickets';

const REQUESTER = { id: 'req-1', email: 'r1@test.dev', displayName: 'Ariya' };
const CATEGORIES = [{ id: 1, name: 'Hardware' }];
const RELATED_SYSTEMS = [{ id: 1, code: 'ERP', name: 'ERP System' }];

const TICKET_DETAIL_RESPONSE = {
  id: 'tkt-1',
  ticketNo: 'TCK-2026-0001',
  summary: 'Printer is broken',
  description: 'It will not turn on at all after the outage yesterday.',
  category: { id: 1, name: 'Hardware' },
  relatedSystem: null,
  status: 'NEW',
  requestedPriority: 'MEDIUM',
  itPriority: 'MEDIUM',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  attachmentCount: 0,
  requester: { id: 'req-1', displayName: 'Ariya' },
  owner: null,
  resolutionSummary: null,
  version: 1,
};

function TicketDetailStub() {
  const location = useLocation();
  const state = location.state as { uploadSummary?: unknown } | null;
  return (
    <div>
      TICKET DETAIL {String(state?.uploadSummary ? JSON.stringify(state.uploadSummary) : 'no-summary')}
    </div>
  );
}

function renderPage() {
  sessionStorage.setItem('toktickit.selectedRequesterId', JSON.stringify(REQUESTER));
  return render(
    <RequesterProvider>
      <MemoryRouter initialEntries={['/tickets/new']}>
        <Routes>
          <Route path="/tickets/new" element={<CreateTicketPage />} />
          <Route path="/tickets/:id" element={<TicketDetailStub />} />
          <Route path="/tickets" element={<div>MY TICKETS PAGE</div>} />
        </Routes>
      </MemoryRouter>
    </RequesterProvider>,
  );
}

function mockLookups(categories = CATEGORIES, relatedSystems = RELATED_SYSTEMS) {
  vi.spyOn(lookupsApi, 'fetchCategories').mockResolvedValue(categories);
  vi.spyOn(lookupsApi, 'fetchRelatedSystems').mockResolvedValue(relatedSystems);
}

async function fillValidForm() {
  fireEvent.change(screen.getByLabelText(/summary/i), { target: { value: 'Printer is broken' } });
  fireEvent.change(screen.getByLabelText(/^category$/i), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText(/description/i), {
    target: { value: 'It will not turn on at all after the outage yesterday.' },
  });
}

describe('CreateTicketPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('disables the form when there are no active categories', async () => {
    mockLookups([], []);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/no active categories/i);
    });
    expect(screen.getByLabelText(/summary/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /create ticket/i })).toBeDisabled();
  });

  it('shows local field errors and never calls createTicket when required fields are missing', async () => {
    mockLookups();
    const createSpy = vi.spyOn(ticketsApi, 'createTicket');

    renderPage();
    await screen.findByLabelText(/^category$/i);

    fireEvent.click(screen.getByRole('button', { name: /create ticket/i }));

    await waitFor(() => {
      expect(screen.getByText(/summary is required/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/description is required/i)).toBeInTheDocument();
    expect(screen.getByText(/category is required/i)).toBeInTheDocument();
    expect(createSpy).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/summary/i)).toHaveFocus();
  });

  it('preserves entered values and focuses the first invalid field on a 422 response', async () => {
    mockLookups();
    vi.spyOn(ticketsApi, 'createTicket').mockRejectedValue(
      new ApiError('One or more fields are invalid', 422, [
        { field: 'summary', message: 'Summary must be unique-ish per server rule' },
      ]),
    );

    renderPage();
    await screen.findByLabelText(/^category$/i);
    await fillValidForm();

    fireEvent.click(screen.getByRole('button', { name: /create ticket/i }));

    await waitFor(() => {
      expect(screen.getByText(/summary must be unique-ish/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/summary/i)).toHaveValue('Printer is broken');
    expect(screen.getByLabelText(/description/i)).toHaveValue(
      'It will not turn on at all after the outage yesterday.',
    );
    expect(screen.getByLabelText(/summary/i)).toHaveFocus();
    expect(screen.getByRole('button', { name: /create ticket/i })).toBeEnabled();
  });

  it('navigates immediately on a successful create with no staged files', async () => {
    mockLookups();
    vi.spyOn(ticketsApi, 'createTicket').mockResolvedValue(TICKET_DETAIL_RESPONSE);
    const uploadSpy = vi.spyOn(attachmentsApi, 'uploadAttachment');

    renderPage();
    await screen.findByLabelText(/^category$/i);
    await fillValidForm();

    fireEvent.click(screen.getByRole('button', { name: /create ticket/i }));

    await waitFor(() => {
      expect(screen.getByText(/TICKET DETAIL/)).toBeInTheDocument();
    });
    expect(screen.getByText(/no-summary/)).toBeInTheDocument();
    expect(uploadSpy).not.toHaveBeenCalled();
  });

  it('still navigates when a staged upload fails, carrying the failure summary in navigation state', async () => {
    mockLookups();
    vi.spyOn(ticketsApi, 'createTicket').mockResolvedValue(TICKET_DETAIL_RESPONSE);
    vi.spyOn(attachmentsApi, 'uploadAttachment').mockRejectedValue(new Error('file type not allowed'));

    renderPage();
    await screen.findByLabelText(/^category$/i);
    await fillValidForm();

    const file = new File(['x'], 'invoice.exe', { type: 'application/octet-stream' });
    Object.defineProperty(file, 'name', { value: 'invoice.pdf' });
    const fileInput = screen.getByLabelText(/attachments/i);
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.click(screen.getByRole('button', { name: /create ticket/i }));

    await waitFor(() => {
      expect(screen.getByText(/TICKET DETAIL/)).toBeInTheDocument();
    });
    expect(screen.getByText(/file type not allowed/)).toBeInTheDocument();
    expect(screen.getByText(/"attempted":1/)).toBeInTheDocument();
    expect(screen.getByText(/"succeeded":0/)).toBeInTheDocument();
  });
});
