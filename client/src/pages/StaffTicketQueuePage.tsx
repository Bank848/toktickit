import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchStaffTickets, fetchAssignableOwners, type StaffTicketListItemDto, type UserSummaryDto } from '../api/staffTickets';
import { type ListTicketsMeta } from '../api/tickets';
import { TicketStatusBadge, PriorityBadge, STATUS_OPTIONS } from '../components/TicketStatusBadge';
import { Icon } from '../components/Icon';

const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'createdAt:asc', label: 'Oldest first' },
  { value: 'updatedAt:desc', label: 'Recently updated' },
  { value: 'ticketNo:asc', label: 'Ticket No.' },
] as const;

const PRIORITY_OPTIONS = [
  { value: '', label: 'Any' }, { value: 'LOW', label: 'Low' }, { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' }, { value: 'URGENT', label: 'Urgent' },
] as const;

const DEFAULT_SORT = 'createdAt:desc';
const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

interface QueryState {
  status: string[];
  itPriority: string;
  ownerId: string;
  q: string;
  sort: string;
  page: number;
}

const DEFAULT_QUERY: QueryState = { status: [], itPriority: '', ownerId: '', q: '', sort: DEFAULT_SORT, page: 1 };

type LoadState = 'loading' | 'loaded' | 'error';

function isFilterActive(query: QueryState): boolean {
  return query.status.length > 0 || query.itPriority !== '' || query.ownerId !== '' || query.q !== '' || query.sort !== DEFAULT_SORT;
}

export function StaffTicketQueuePage() {
  const navigate = useNavigate();

  const [owners, setOwners] = useState<UserSummaryDto[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState<QueryState>(DEFAULT_QUERY);
  const [tickets, setTickets] = useState<StaffTicketListItemDto[]>([]);
  const [meta, setMeta] = useState<ListTicketsMeta>({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 });
  const [loadState, setLoadState] = useState<LoadState>('loading');

  useEffect(() => {
    fetchAssignableOwners().then(setOwners).catch(() => setOwners([]));
  }, []);

  useEffect(() => {
    const trimmed = searchInput.trim();
    const handle = setTimeout(() => {
      setQuery((prev) => (prev.q === trimmed ? prev : { ...prev, q: trimmed, page: 1 }));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const loadTickets = useCallback(() => {
    setLoadState('loading');
    fetchStaffTickets({
      status: query.status,
      itPriority: query.itPriority === '' ? null : query.itPriority,
      ownerId: query.ownerId === '' ? null : query.ownerId,
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
      .catch(() => setLoadState('error'));
  }, [query]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  function updateQuery(patch: Partial<Omit<QueryState, 'page'>>) {
    setQuery((prev) => ({ ...prev, ...patch, page: 1 }));
  }

  function handleStatusChange(event: React.ChangeEvent<HTMLSelectElement>) {
    updateQuery({ status: Array.from(event.target.selectedOptions).map((option) => option.value) });
  }

  function handleClearFilters() {
    setSearchInput('');
    setQuery(DEFAULT_QUERY);
  }

  function goToTicket(id: string) {
    navigate(`/staff/tickets/${id}`);
  }

  const filtersActive = isFilterActive(query);
  const rows = tickets;

  return (
    <div>
      <h1>My Queue</h1>

      <div className="row g-2 mb-3 align-items-start">
        <div className="col-12 col-md-3">
          <label htmlFor="staff-queue-search" className="form-label">Search</label>
          <input
            id="staff-queue-search"
            type="text"
            className="form-control"
            placeholder="Search by ticket number or summary"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>

        <div className="col-6 col-md-2">
          <label htmlFor="staff-queue-status" className="form-label">Status</label>
          <select id="staff-queue-status" className="form-select" multiple size={4} value={query.status} onChange={handleStatusChange}>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div className="col-6 col-md-2">
          <label htmlFor="staff-queue-priority" className="form-label">IT Priority</label>
          <select
            id="staff-queue-priority"
            className="form-select"
            value={query.itPriority}
            onChange={(event) => updateQuery({ itPriority: event.target.value })}
          >
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div className="col-6 col-md-2">
          <label htmlFor="staff-queue-owner" className="form-label">Owner</label>
          <select
            id="staff-queue-owner"
            className="form-select"
            value={query.ownerId}
            onChange={(event) => updateQuery({ ownerId: event.target.value })}
          >
            <option value="">Any</option>
            <option value="unassigned">Unassigned</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>{owner.displayName}</option>
            ))}
          </select>
        </div>

        <div className="col-6 col-md-2">
          <label htmlFor="staff-queue-sort" className="form-label">Sort</label>
          <select id="staff-queue-sort" className="form-select" value={query.sort} onChange={(event) => updateQuery({ sort: event.target.value })}>
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div className="col-6 col-md-1">
          <label className="form-label d-none d-md-block" aria-hidden="true">&nbsp;</label>
          <button type="button" className="btn btn-outline-primary w-100" onClick={handleClearFilters} disabled={!filtersActive}>
            Clear filters
          </button>
        </div>
      </div>

      {loadState === 'loading' && (
        <div data-testid="staff-queue-skeleton" aria-busy="true" aria-live="polite">
          <p className="text-body-secondary d-flex align-items-center gap-2">
            <span className="spinner-border spinner-border-sm" aria-hidden="true" /> Loading queue…
          </p>
        </div>
      )}

      {loadState === 'error' && (
        <div role="alert" className="alert alert-danger">
          <Icon name="exclamation-triangle-fill" />
          <div>
            <p>Failed to load the ticket queue.</p>
            <button type="button" className="btn btn-outline-danger btn-sm" onClick={loadTickets}>
              <Icon name="arrow-repeat" className="me-1" />Retry
            </button>
          </div>
        </div>
      )}

      {loadState === 'loaded' && rows.length === 0 && !filtersActive && (
        <div className="alert alert-note-neutral">
          <Icon name="inbox" />
          <p>No tickets in the queue yet</p>
        </div>
      )}

      {loadState === 'loaded' && rows.length === 0 && filtersActive && (
        <div className="alert alert-note">
          <Icon name="info-circle" />
          <div>
            <p>No tickets match your filters.</p>
            <button type="button" className="btn btn-outline-primary btn-sm mt-2" onClick={handleClearFilters}>
              Clear filters
            </button>
          </div>
        </div>
      )}

      {loadState === 'loaded' && rows.length > 0 && (
        <>
          <div className="card d-none d-md-block">
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th scope="col">Ticket No.</th>
                  <th scope="col">Created</th>
                  <th scope="col">Summary</th>
                  <th scope="col">Category</th>
                  <th scope="col">Req. Priority</th>
                  <th scope="col">IT Priority</th>
                  <th scope="col">Status</th>
                  <th scope="col">Owner</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((ticket) => (
                  <tr
                    key={ticket.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => goToTicket(ticket.id)}
                    onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') goToTicket(ticket.id); }}
                  >
                    <td>{ticket.ticketNo}</td>
                    <td className="text-body-secondary small">{new Date(ticket.createdAt).toLocaleDateString()}</td>
                    <td>{ticket.summary}</td>
                    <td>{ticket.category.name}</td>
                    <td><PriorityBadge priority={ticket.requestedPriority} /></td>
                    <td><PriorityBadge priority={ticket.itPriority} /></td>
                    <td><TicketStatusBadge status={ticket.status} /></td>
                    <td>{ticket.owner ? ticket.owner.displayName : 'Unassigned'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="d-md-none">
            {rows.map((ticket) => (
              <div
                key={ticket.id}
                className="card mb-2"
                role="button"
                tabIndex={0}
                onClick={() => goToTicket(ticket.id)}
                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') goToTicket(ticket.id); }}
              >
                <div className="card-body">
                  <p className="mb-1"><strong>Ticket No.:</strong> {ticket.ticketNo}</p>
                  <p className="mb-1"><strong>Summary:</strong> {ticket.summary}</p>
                  <p className="mb-1"><strong>Category:</strong> {ticket.category.name}</p>
                  <p className="mb-1"><strong>Status:</strong> <TicketStatusBadge status={ticket.status} /></p>
                  <p className="mb-1"><strong>IT Priority:</strong> <PriorityBadge priority={ticket.itPriority} /></p>
                  <p className="mb-0"><strong>Owner:</strong> {ticket.owner ? ticket.owner.displayName : 'Unassigned'}</p>
                </div>
              </div>
            ))}
          </div>

          <nav aria-label="Ticket queue pagination" className="mt-3">
            <ul className="pagination justify-content-end mb-0">
              {Array.from({ length: meta.totalPages }, (_, index) => index + 1).map((pageNumber) => (
                <li key={pageNumber} className={`page-item ${pageNumber === meta.page ? 'active' : ''}`}>
                  <button
                    type="button"
                    className="page-link"
                    aria-current={pageNumber === meta.page ? 'page' : undefined}
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
