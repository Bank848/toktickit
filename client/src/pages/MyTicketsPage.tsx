import { useCallback, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useRequester } from '../context/RequesterContext';
import { fetchTickets, type TicketListItemDto, type ListTicketsMeta } from '../api/tickets';
import { fetchCategories, type CategoryDto } from '../api/lookups';
import { TicketStatusBadge, STATUS_OPTIONS } from '../components/TicketStatusBadge';

const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'createdAt:asc', label: 'Oldest first' },
  { value: 'updatedAt:desc', label: 'Recently updated' },
  { value: 'ticketNo:asc', label: 'Ticket No.' },
] as const;

const DEFAULT_SORT = 'createdAt:desc';
const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

interface QueryState {
  status: string[];
  categoryId: string; // '' means no category filter, keeps <select> value controlled
  q: string;
  sort: string;
  page: number;
}

const DEFAULT_QUERY: QueryState = { status: [], categoryId: '', q: '', sort: DEFAULT_SORT, page: 1 };

type LoadState = 'loading' | 'loaded' | 'error';

function isFilterActive(query: QueryState): boolean {
  return query.status.length > 0 || query.categoryId !== '' || query.q !== '' || query.sort !== DEFAULT_SORT;
}

export function MyTicketsPage() {
  const { requester } = useRequester();
  const navigate = useNavigate();

  const [categories, setCategories] = useState<CategoryDto[]>([]);

  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState<QueryState>(DEFAULT_QUERY);

  const [tickets, setTickets] = useState<TicketListItemDto[]>([]);
  const [meta, setMeta] = useState<ListTicketsMeta>({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 });
  const [loadState, setLoadState] = useState<LoadState>('loading');

  useEffect(() => {
    if (!requester) return;
    fetchCategories(requester.id)
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [requester]);

  // Debounce the raw search box into `query.q` -- a plain useEffect + timeout, not a debounce
  // library, per the plan. Every other filter (status/category/sort) updates `query` immediately
  // via updateQuery below; search alone waits SEARCH_DEBOUNCE_MS so a fetch isn't fired per
  // keystroke.
  useEffect(() => {
    const trimmed = searchInput.trim();
    const handle = setTimeout(() => {
      setQuery((prev) => (prev.q === trimmed ? prev : { ...prev, q: trimmed, page: 1 }));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const loadTickets = useCallback(() => {
    if (!requester) return;
    setLoadState('loading');
    fetchTickets(requester.id, {
      status: query.status,
      categoryId: query.categoryId === '' ? null : Number(query.categoryId),
      q: query.q === '' ? null : query.q,
      page: query.page,
      pageSize: PAGE_SIZE,
      sort: query.sort,
    })
      .then((result) => {
        setTickets(result.data);
        setMeta(result.meta);
        setLoadState('loaded');
      })
      .catch(() => {
        setLoadState('error');
      });
  }, [requester, query]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  if (!requester) return null;

  // Any filter/sort change resets to page 1 (search does the same, inside the debounce effect
  // above) -- per ui-spec.md §5.
  function updateQuery(patch: Partial<Omit<QueryState, 'page'>>) {
    setQuery((prev) => ({ ...prev, ...patch, page: 1 }));
  }

  function handleStatusChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const values = Array.from(event.target.selectedOptions).map((option) => option.value);
    updateQuery({ status: values });
  }

  function handleClearFilters() {
    setSearchInput('');
    setQuery(DEFAULT_QUERY);
  }

  function goToTicket(id: string) {
    navigate(`/tickets/${id}`);
  }

  const filtersActive = isFilterActive(query);
  const rows = tickets;

  return (
    <div>
      <h1>My Tickets</h1>

      <div className="row g-2 mb-3 align-items-end">
        <div className="col-12 col-md-4">
          <label htmlFor="my-tickets-search" className="form-label">
            Search
          </label>
          <input
            id="my-tickets-search"
            type="text"
            className="form-control"
            placeholder="Search by ticket number or summary"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>

        <div className="col-6 col-md-3">
          <label htmlFor="my-tickets-status" className="form-label">
            Status
          </label>
          <select
            id="my-tickets-status"
            className="form-select"
            multiple
            value={query.status}
            onChange={handleStatusChange}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="col-6 col-md-2">
          <label htmlFor="my-tickets-category" className="form-label">
            Category
          </label>
          <select
            id="my-tickets-category"
            className="form-select"
            value={query.categoryId}
            onChange={(event) => updateQuery({ categoryId: event.target.value })}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="col-6 col-md-2">
          <label htmlFor="my-tickets-sort" className="form-label">
            Sort
          </label>
          <select
            id="my-tickets-sort"
            className="form-select"
            value={query.sort}
            onChange={(event) => updateQuery({ sort: event.target.value })}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="col-6 col-md-1">
          <button type="button" className="btn btn-outline-secondary w-100" onClick={handleClearFilters} disabled={!filtersActive}>
            Clear filters
          </button>
        </div>
      </div>

      {loadState === 'loading' && (
        <div data-testid="my-tickets-skeleton" aria-busy="true" aria-live="polite">
          <p>Loading tickets…</p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="placeholder-glow mb-2">
              <span className="placeholder col-12" style={{ height: '2rem', display: 'block' }} />
            </div>
          ))}
        </div>
      )}

      {loadState === 'error' && (
        <div role="alert">
          <p>Failed to load tickets.</p>
          <button type="button" onClick={loadTickets}>
            Retry
          </button>
        </div>
      )}

      {loadState === 'loaded' && rows.length === 0 && !filtersActive && (
        <div>
          <p>You haven&apos;t created any tickets yet.</p>
          <Link to="/tickets/new">Create Ticket</Link>
        </div>
      )}

      {loadState === 'loaded' && rows.length === 0 && filtersActive && (
        <div>
          <p>No tickets match your filters.</p>
          <button type="button" onClick={handleClearFilters}>
            Clear filters
          </button>
        </div>
      )}

      {loadState === 'loaded' && rows.length > 0 && (
        <>
          {/* Desktop table -- CSS-only responsive toggle (no resize listener), per the plan. */}
          <table className="table d-none d-md-table">
            <thead>
              <tr>
                <th scope="col">Ticket No.</th>
                <th scope="col">Summary</th>
                <th scope="col">Category</th>
                <th scope="col">Status</th>
                <th scope="col">Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((ticket) => (
                <tr
                  key={ticket.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => goToTicket(ticket.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') goToTicket(ticket.id);
                  }}
                >
                  <td>{ticket.ticketNo}</td>
                  <td>{ticket.summary}</td>
                  <td>{ticket.category.name}</td>
                  <td>
                    <TicketStatusBadge status={ticket.status} />
                  </td>
                  <td>{new Date(ticket.updatedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile stacked cards -- same rows, CSS-only toggle. */}
          <div className="d-md-none">
            {rows.map((ticket) => (
              <div
                key={ticket.id}
                className="card mb-2"
                role="button"
                tabIndex={0}
                onClick={() => goToTicket(ticket.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') goToTicket(ticket.id);
                }}
              >
                <div className="card-body">
                  <p>
                    <strong>Ticket No.:</strong> {ticket.ticketNo}
                  </p>
                  <p>
                    <strong>Summary:</strong> {ticket.summary}
                  </p>
                  <p>
                    <strong>Category:</strong> {ticket.category.name}
                  </p>
                  <p>
                    <strong>Status:</strong> <TicketStatusBadge status={ticket.status} />
                  </p>
                  <p>
                    <strong>Last Updated:</strong> {new Date(ticket.updatedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <nav aria-label="Ticket list pagination">
            <ul className="pagination">
              {Array.from({ length: meta.totalPages }, (_, index) => index + 1).map((pageNumber) => (
                <li key={pageNumber} className={`page-item ${pageNumber === meta.page ? 'active' : ''}`}>
                  <button
                    type="button"
                    className="page-link"
                    onClick={() => setQuery((prev) => ({ ...prev, page: pageNumber }))}
                  >
                    {pageNumber}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </>
      )}
    </div>
  );
}
