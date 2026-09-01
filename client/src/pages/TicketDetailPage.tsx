import { useCallback, useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useRequester } from '../context/RequesterContext';
import { fetchTicketDetail, ApiError, type TicketDetailDto } from '../api/tickets';
import { AttachmentSection } from '../components/AttachmentSection';
import { TicketStatusBadge } from '../components/TicketStatusBadge';

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
      {loadState === 'loading' && <p>Loading ticket…</p>}

      {loadState === 'not-found' && <p>Ticket not found.</p>}

      {loadState === 'error' && (
        <div role="alert">
          <p>Failed to load ticket.</p>
          <button type="button" onClick={loadTicket}>
            Retry
          </button>
        </div>
      )}

      {loadState === 'loaded' && ticket && (
        <>
          {uploadSummary && !uploadSummaryDismissed && (
            <div role="alert">
              <p>
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
              <button type="button" onClick={() => setUploadSummaryDismissed(true)}>
                Dismiss
              </button>
            </div>
          )}

          <h1>{ticket.ticketNo}</h1>
          <p>{new Date(ticket.createdAt).toLocaleString()}</p>
          <p>Category: {ticket.category.name}</p>
          <p>Related System: {ticket.relatedSystem?.name ?? 'Not applicable'}</p>
          <p>Requester: {ticket.requester.displayName}</p>
          <p>Owner: {ticket.owner?.displayName ?? 'Unassigned'}</p>
          <p>
            Requested Priority: <TicketStatusBadge status={ticket.requestedPriority} />
          </p>
          <p>
            IT Priority: <TicketStatusBadge status={ticket.itPriority} />
          </p>
          <p>
            Status: <TicketStatusBadge status={ticket.status} />
          </p>
          <h2>Summary</h2>
          <p>{ticket.summary}</p>
          <h2>Description</h2>
          <p>{ticket.description}</p>
          <h2>Resolution</h2>
          <p>{ticket.resolutionSummary ?? 'No resolution yet'}</p>

          <AttachmentSection ticketId={ticket.id} requesterId={requester.id} ticketStatus={ticket.status} />
        </>
      )}
    </div>
  );
}
