import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchRequesterDashboard, type RequesterDashboardDto } from '../api/dashboard';

type LoadState = 'loading' | 'loaded' | 'error';

const CARD_STATUSES: { key: string; label: string }[] = [
  { key: 'OPEN', label: 'Open' },
  { key: 'WAITING_FOR_REQUESTER', label: 'Waiting' },
  { key: 'RESOLVED', label: 'Resolved' },
  { key: 'CLOSED', label: 'Closed' },
];

export function RequesterDashboardPage() {
  const [data, setData] = useState<RequesterDashboardDto | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');

  const load = useCallback(() => {
    setLoadState('loading');
    fetchRequesterDashboard()
      .then((d) => {
        setData(d);
        setLoadState('loaded');
      })
      .catch(() => setLoadState('error'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loadState === 'loading') return <p aria-busy="true">Loading your dashboard…</p>;
  if (loadState === 'error' || !data) {
    return (
      <div role="alert" className="alert alert-danger">
        <p>Failed to load your dashboard.</p>
        <button type="button" className="btn btn-outline-danger btn-sm" onClick={load}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1>My Dashboard</h1>
      <div className="row g-3 mb-4">
        {CARD_STATUSES.map((c) => (
          <div key={c.key} className="col-6 col-md-3">
            {/* FR-10: each card links to the detailed screen filtered to match, not a bare nav
                link. The count stays inside the link's accessible name ("Open 2") so screen
                reader users hear it too, matching StaffDashboardPage. */}
            <Link to={`/tickets?status=${c.key}`} className="card text-center text-decoration-none text-reset">
              <div className="card-body">
                <p className="text-body-secondary small mb-1">{c.label}</p>
                <p className="fs-2 mb-0">
                  {data.statusCounts[c.key] ?? 0}
                </p>
              </div>
            </Link>
          </div>
        ))}
      </div>

      <div className="d-flex gap-2 mb-4">
        <Link to="/tickets/new" className="btn btn-primary btn-sm">
          Create Ticket
        </Link>
        <Link to="/tickets" className="btn btn-outline-secondary btn-sm">
          View My Tickets
        </Link>
      </div>

      <h2>Recent Tickets</h2>
      {data.recentTickets.length === 0 && <p className="text-body-secondary">No recent tickets.</p>}
      {data.recentTickets.map((t) => (
        <div key={t.id} className="border-bottom py-2">
          <Link to={`/tickets/${t.id}`}>{t.ticketNo}</Link> <span className="text-body-secondary">{t.summary}</span>{' '}
          <span className="badge badge-tone-neutral">{t.status}</span>
        </div>
      ))}
    </div>
  );
}
