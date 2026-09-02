import { useCallback, useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useRequester } from '../context/RequesterContext';
import { fetchTicketDetail, ApiError, type TicketDetailDto } from '../api/tickets';
import { AttachmentSection } from '../components/AttachmentSection';
import { TicketStatusBadge } from '../components/TicketStatusBadge';
import { Icon } from '../components/Icon';

interface UploadFailure {
  filename: string;
  message: string;
}

interface UploadSummary {
  attempted: number;
  succeeded: number;
  failures: UploadFailure[];
}

interface LocationState {
  uploadSummary?: UploadSummary;
}

type LoadState = 'loading' | 'loaded' | 'not-found' | 'error';

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { requester } = useRequester();
  const location = useLocation();

  const [ticket, setTicket] = useState<TicketDetailDto | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [uploadSummaryDismissed, setUploadSummaryDismissed] = useState(false);

  const loadTicket = useCallback(() => {
    if (!requester || !id) return;
    setLoadState('loading');
    fetchTicketDetail(requester.id, id)
      .then((data) => {
        setTicket(data);
        setLoadState('loaded');
      })
      .catch((error) => {
        // A 404 renders the generic "Ticket not found" message only, never a 403-style "not
        // yours" message that would confirm existence (D-24) -- every other failure gets the
        // separate error+retry state instead of being mislabeled as not-found.
        if (error instanceof ApiError && error.status === 404) {
          setLoadState('not-found');
        } else {
          setLoadState('error');
        }
      });
  }, [requester, id]);

  // Fetches on every mount, not just when id changes -- satisfies the "discard cached data on
  // requester switch" rule from W4-1 (AppShell remounts this page after Change Requester).
  useEffect(() => {
    loadTicket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, requester?.id]);

  if (!requester) return null;

  const uploadSummary = (location.state as LocationState | null)?.uploadSummary;

  return (
    <div>
      {loadState === 'loading' && (
        <p className="text-body-secondary d-flex align-items-center gap-2">
          <span className="spinner-border spinner-border-sm" aria-hidden="true" /> Loading ticket…
        </p>
      )}

      {loadState === 'not-found' && (
        <div className="alert alert-note-neutral">
          <Icon name="info-circle" />
          <p>Ticket not found.</p>
        </div>
      )}

      {loadState === 'error' && (
        <div role="alert" className="alert alert-danger">
          <Icon name="exclamation-triangle-fill" />
          <div>
            <p>Failed to load ticket.</p>
            <button type="button" className="btn btn-outline-danger btn-sm" onClick={loadTicket}>
              <Icon name="arrow-repeat" className="me-1" />
              Retry
            </button>
          </div>
        </div>
      )}

      {loadState === 'loaded' && ticket && (
        <>
          {uploadSummary && !uploadSummaryDismissed && (
            <div role="alert" className="alert alert-warning alert-dismissible">
              <Icon name="exclamation-triangle-fill" />
              <p className="mb-0">
                {uploadSummary.succeeded} of {uploadSummary.attempted} files attached.
                {uploadSummary.failures.length > 0 && (
                  <>
                    {' '}
                    {uploadSummary.failures.length} failed:{' '}
                    {uploadSummary.failures
                      .map((failure) => `${failure.filename} — ${failure.message}`)
                      .join(', ')}
                    . Retry from Attachments below.
                  </>
                )}
              </p>
              <button
                type="button"
                className="btn-close"
                aria-label="Dismiss"
                onClick={() => setUploadSummaryDismissed(true)}
              />
            </div>
          )}

          <div className="card">
            <div className="card-body">
              <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
                <h1 className="mb-0 me-2">{ticket.ticketNo}</h1>
                <TicketStatusBadge status={ticket.status} />
              </div>

              <dl className="row mb-4">
                <dt className="col-6 col-md-3 field-label">Date</dt>
                <dd className="col-6 col-md-3">{new Date(ticket.createdAt).toLocaleString()}</dd>
                <dt className="col-6 col-md-3 field-label">Category</dt>
                <dd className="col-6 col-md-3">{ticket.category.name}</dd>

                <dt className="col-6 col-md-3 field-label">Related System</dt>
                <dd className="col-6 col-md-3">{ticket.relatedSystem?.name ?? 'Not applicable'}</dd>
                <dt className="col-6 col-md-3 field-label">Requester</dt>
                <dd className="col-6 col-md-3">{ticket.requester.displayName}</dd>

                <dt className="col-6 col-md-3 field-label">Owner</dt>
                <dd className="col-6 col-md-3 text-body-secondary">{ticket.owner?.displayName ?? 'Unassigned'}</dd>
                <dt className="col-6 col-md-3 field-label">Requested Priority</dt>
                <dd className="col-6 col-md-3">
                  <TicketStatusBadge status={ticket.requestedPriority} />
                </dd>

                <dt className="col-6 col-md-3 field-label">IT Priority</dt>
                <dd className="col-6 col-md-3">
                  <TicketStatusBadge status={ticket.itPriority} />
                </dd>
              </dl>

              <h2>Summary</h2>
              <p>{ticket.summary}</p>
              <h2>Description</h2>
              <p style={{ whiteSpace: 'pre-wrap' }}>{ticket.description}</p>
              <h2>Resolution</h2>
              <p className="text-body-secondary mb-0">{ticket.resolutionSummary ?? 'No resolution yet'}</p>
            </div>
          </div>

          <div className="card mt-3">
            <div className="card-body">
              <AttachmentSection ticketId={ticket.id} requesterId={requester.id} ticketStatus={ticket.status} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
