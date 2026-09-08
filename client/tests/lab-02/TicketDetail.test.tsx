import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../../src/context/AuthContext';
import { TicketDetailPage } from '../../src/pages/TicketDetailPage';
import * as authApi from '../../src/api/auth';
import * as ticketsApi from '../../src/api/tickets';
import * as attachmentsApi from '../../src/api/attachments';
import { ApiError } from '../../src/api/tickets';

const REQUESTER = {
  id: 'req-1',
  email: 'r1@test.dev',
  displayName: 'Ariya',
  role: 'REQUESTER' as const,
  mustChangePassword: false,
};

const TICKET: ticketsApi.TicketDetailDto = {
  id: 'tkt-1',
  ticketNo: 'TKT-2026-00001',
  summary: 'VPN keeps disconnecting',
  description: 'It drops every 5 minutes.',
  category: { id: 1, name: 'Network' },
  relatedSystem: null,
  status: 'NEW',
  requestedPriority: 'HIGH',
  itPriority: 'MEDIUM',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  attachmentCount: 0,
  requester: { id: REQUESTER.id, displayName: 'Ariya' },
  owner: null,
  resolutionSummary: null,
  version: 1,
};

function renderPage(initialEntries: Array<string | { pathname: string; state?: unknown }> = ['/tickets/tkt-1']) {
  vi.spyOn(authApi, 'fetchMe').mockResolvedValue(REQUESTER);
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetailPage />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe('TicketDetailPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    vi.spyOn(attachmentsApi, 'fetchAttachments').mockResolvedValue([]);
  });

  it('renders a loading state before the ticket resolves', async () => {
    let resolveFetch: (value: ticketsApi.TicketDetailDto) => void = () => {};
    vi.spyOn(ticketsApi, 'fetchTicketDetail').mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });
    resolveFetch(TICKET);
    await waitFor(() => {
      expect(screen.queryByText(/loading ticket/i)).not.toBeInTheDocument();
    });
  });

  it('renders a generic "Ticket not found" message on a 404, never a not-yours message', async () => {
    vi.spyOn(ticketsApi, 'fetchTicketDetail').mockRejectedValue(new ApiError('Ticket not found', 404));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/ticket not found/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/not yours/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/forbidden/i)).not.toBeInTheDocument();
  });

  it('renders every header field, with "Not applicable"/"Unassigned"/"No resolution yet" fallbacks when null', async () => {
    vi.spyOn(ticketsApi, 'fetchTicketDetail').mockResolvedValue(TICKET);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(TICKET.ticketNo)).toBeInTheDocument();
    });
    expect(screen.getByText(TICKET.summary)).toBeInTheDocument();
    expect(screen.getByText(TICKET.description)).toBeInTheDocument();
    expect(screen.getByText(/network/i)).toBeInTheDocument();
    expect(screen.getByText(/not applicable/i)).toBeInTheDocument();
    expect(screen.getByText(/unassigned/i)).toBeInTheDocument();
    expect(screen.getByText(/no resolution yet/i)).toBeInTheDocument();
    expect(screen.getByText(/ariya/i)).toBeInTheDocument();
  });

  it('renders location.state.uploadSummary as a dismissible alert when present', async () => {
    vi.spyOn(ticketsApi, 'fetchTicketDetail').mockResolvedValue(TICKET);

    renderPage([
      {
        pathname: '/tickets/tkt-1',
        state: {
          uploadSummary: {
            attempted: 3,
            succeeded: 2,
            failures: [{ filename: 'invoice.exe', message: 'file type not allowed' }],
          },
        },
      },
    ]);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByText(/2 of 3/i)).toBeInTheDocument();
    expect(screen.getByText(/invoice\.exe/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    await waitFor(() => {
      expect(screen.queryByText(/invoice\.exe/i)).not.toBeInTheDocument();
    });
  });

  it('re-fetches ticket detail on every mount (requester-switch cache-discard regression)', async () => {
    const fetchSpy = vi.spyOn(ticketsApi, 'fetchTicketDetail').mockResolvedValue(TICKET);

    const { unmount } = renderPage();
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    unmount();

    renderPage();
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
  });

});
