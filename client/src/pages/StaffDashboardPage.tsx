import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchStaffDashboard, type StaffDashboardDto } from '../api/dashboard';
import { useAuth } from '../context/AuthContext';

type LoadState = 'loading' | 'loaded' | 'error';

const CARD_STATUSES: { key: string; label: string }[] = [
  { key: 'NEW', label: 'New' },
  { key: 'OPEN', label: 'Open' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'WAITING_FOR_REQUESTER', label: 'Waiting' },
];

const CARD_PRIORITIES: { key: string; label: string }[] = [
  { key: 'LOW', label: 'Low' },
  { key: 'MEDIUM', label: 'Medium' },
  { key: 'HIGH', label: 'High' },
  { key: 'URGENT', label: 'Urgent' },
];

const ROLE_LABELS: Record<string, string> = { REQUESTER: 'Requesters', IT_STAFF: 'IT Staff', ADMINISTRATOR: 'Administrators' };

export function StaffDashboardPage() {
  const { currentUser } = useAuth();
  const [data, setData] = useState<StaffDashboardDto | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');

  const load = useCallback(() => {
    setLoadState('loading');
    fetchStaffDashboard().then((d) => { setData(d); setLoadState('loaded'); }).catch(() => setLoadState('error'));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loadState === 'loading') return <p aria-busy="true">Loading dashboard…</p>;
  if (loadState === 'error' || !data || !currentUser) {
    return (
      <div role="alert" className="alert alert-danger">
        <p>Failed to load dashboard.</p>
        <button type="button" className="btn btn-outline-danger btn-sm" onClick={load}>Retry</button>
      </div>
    );
  }

  return (
    <div>
      <h1>{currentUser.role === 'ADMINISTRATOR' ? 'Administrator Dashboard' : 'IT Staff Dashboard'}</h1>
      <div className="row g-3 mb-3">
        {CARD_STATUSES.map((c) => (
          <div key={c.key} className="col-6 col-md-3">
            <Link to={`/staff/tickets?status=${c.key}`} className="card text-center text-decoration-none text-reset">
              <div className="card-body">
                <p className="text-body-secondary small mb-1">{c.label}</p>
                <p className="fs-2 mb-0">{data.statusCounts[c.key] ?? 0}</p>
              </div>
            </Link>
          </div>
        ))}
        <div className="col-6 col-md-3">
          <Link to={`/staff/tickets?ownerId=${currentUser.id}`} className="card text-center text-decoration-none text-reset">
            <div className="card-body">
              <p className="text-body-secondary small mb-1">Assigned to me</p>
              <p className="fs-2 mb-0">{data.ownedByMeCount}</p>
            </div>
          </Link>
        </div>
      </div>

      {/* FR-08: IT Priority breakdown, not just status -- missing entirely from the first draft. */}
      <div className="row g-3 mb-3">
        {CARD_PRIORITIES.map((p) => (
          <div key={p.key} className="col-6 col-md-3">
            <Link to={`/staff/tickets?itPriority=${p.key}`} className="card text-center text-decoration-none text-reset">
              <div className="card-body">
                <p className="text-body-secondary small mb-1">{p.label}</p>
                <p className="fs-2 mb-0">{data.priorityCounts[p.key] ?? 0}</p>
              </div>
            </Link>
          </div>
        ))}
      </div>

      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <Link to="/staff/tickets?ownerId=unassigned" className="card text-center text-decoration-none text-reset">
            <div className="card-body">
              <p className="text-body-secondary small mb-1">Unassigned</p>
              <p className="fs-2 mb-0">{data.unassignedCount}</p>
            </div>
          </Link>
        </div>
        {data.userCounts && (
          <div className="col-md-6">
            <div className="card">
              <div className="card-body">
                <p className="text-body-secondary small mb-2">User accounts by role</p>
                <div className="d-flex gap-3">
                  {Object.entries(data.userCounts).map(([role, count]) => (
                    <span key={role}>{ROLE_LABELS[role] ?? role}: <strong>{count}</strong></span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mb-4">
        <Link to="/staff/tickets" className="btn btn-primary btn-sm">Go to Ticket Queue</Link>
      </div>

      <h2>Recently Updated Tickets</h2>
      {data.recentTickets.length === 0 && <p className="text-body-secondary">No recent tickets.</p>}
      {data.recentTickets.map((t) => (
        <div key={t.id} className="border-bottom py-2">
          <Link to={`/staff/tickets/${t.id}`}>{t.ticketNo}</Link>{' '}
          <span className="text-body-secondary">{t.summary}</span>{' '}
          <span className="badge badge-tone-neutral">{t.status}</span>
        </div>
      ))}
    </div>
  );
}
