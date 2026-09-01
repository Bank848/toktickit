import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { RequesterProvider } from '../../src/context/RequesterContext';
import { MyTicketsPage } from '../../src/pages/MyTicketsPage';
import * as ticketsApi from '../../src/api/tickets';
import * as lookupsApi from '../../src/api/lookups';

const REQUESTER = { id: 'req-1', email: 'r1@test.dev', displayName: 'Ariya' };
const CATEGORIES = [{ id: 1, name: 'Hardware' }];

const TICKET: ticketsApi.TicketListItemDto = {
  id: 'tkt-1',
  ticketNo: 'TKT-2026-00001',
  summary: 'VPN keeps disconnecting',
  category: { id: 1, name: 'Hardware' },
  status: 'NEW',
  requestedPriority: 'MEDIUM',
  itPriority: 'MEDIUM',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  attachmentCount: 0,
};

function emptyResult(): ticketsApi.ListTicketsResult {
  return { data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 1 } };
}

function resultWith(tickets: ticketsApi.TicketListItemDto[]): ticketsApi.ListTicketsResult {
  return { data: tickets, meta: { page: 1, pageSize: 10, total: tickets.length, totalPages: 1 } };
}

function TicketDetailStub() {
  const location = useLocation();
  return <div>TICKET DETAIL {location.pathname}</div>;
}

function renderPage() {
  sessionStorage.setItem('toktickit.selectedRequesterId', JSON.stringify(REQUESTER));
  return render(
    <RequesterProvider>
      <MemoryRouter initialEntries={['/tickets']}>
        <Routes>
          <Route path="/tickets" element={<MyTicketsPage />} />
          <Route path="/tickets/new" element={<div>CREATE TICKET PAGE</div>} />
          <Route path="/tickets/:id" element={<TicketDetailStub />} />
        </Routes>
      </MemoryRouter>
    </RequesterProvider>,
  );
}

describe('MyTicketsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    vi.spyOn(lookupsApi, 'fetchCategories').mockResolvedValue(CATEGORIES);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a loading skeleton before tickets resolve', async () => {
    let resolveFetch: (value: ticketsApi.ListTicketsResult) => void = () => {};
    vi.spyOn(ticketsApi, 'fetchTickets').mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    renderPage();

    expect(screen.getByTestId('my-tickets-skeleton')).toBeInTheDocument();

    resolveFetch(emptyResult());
    await waitFor(() => {
      expect(screen.queryByTestId('my-tickets-skeleton')).not.toBeInTheDocument();
    });
  });

  it('shows "no tickets yet" with a Create Ticket link when there are no filters and zero tickets', async () => {
    vi.spyOn(ticketsApi, 'fetchTickets').mockResolvedValue(emptyResult());

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/you haven.t created any tickets yet/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /create ticket/i })).toHaveAttribute('href', '/tickets/new');
  });

  it('shows "no tickets match your filters" with Clear filters when a search is active and zero results', async () => {
    vi.spyOn(ticketsApi, 'fetchTickets').mockResolvedValue(emptyResult());

    renderPage();
    await screen.findByPlaceholderText(/search by ticket number or summary/i);

    fireEvent.change(screen.getByPlaceholderText(/search by ticket number or summary/i), {
      target: { value: 'nonexistent' },
    });

    await waitFor(
      () => {
        expect(screen.getByText(/no tickets match your filters/i)).toBeInTheDocument();
      },
      { timeout: 1000 },
    );
    for (const button of screen.getAllByRole('button', { name: /clear filters/i })) {
      expect(button).toBeEnabled();
    }
  });

  it('debounces the search box before calling fetchTickets again', async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.spyOn(ticketsApi, 'fetchTickets').mockResolvedValue(resultWith([TICKET]));

    renderPage();
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByPlaceholderText(/search by ticket number or summary/i), {
      target: { value: 'vpn' },
    });

    // Not yet -- debounce window hasn't elapsed.
    vi.advanceTimersByTime(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(150);
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    expect(fetchSpy.mock.calls[1][1]).toMatchObject({ q: 'vpn' });
  });

  it('resets to page 1 when a filter changes', async () => {
    const fetchSpy = vi.spyOn(ticketsApi, 'fetchTickets').mockResolvedValue(resultWith([TICKET]));

    renderPage();
    await screen.findAllByText(TICKET.summary);

    fireEvent.change(screen.getByLabelText(/^category$/i), { target: { value: '1' } });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenLastCalledWith(REQUESTER.id, expect.objectContaining({ page: 1, categoryId: 1 }));
    });
  });

  it('navigates to the ticket detail route when a row is clicked', async () => {
    vi.spyOn(ticketsApi, 'fetchTickets').mockResolvedValue(resultWith([TICKET]));

    renderPage();
    const summaries = await screen.findAllByText(TICKET.summary);

    fireEvent.click(summaries[0]);

    await waitFor(() => {
      expect(screen.getByText(`TICKET DETAIL /tickets/${TICKET.id}`)).toBeInTheDocument();
    });
  });
});
