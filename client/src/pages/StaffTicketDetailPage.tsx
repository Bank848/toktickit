import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  fetchStaffTicketDetail, fetchAssignableOwners, updateTicketOwner, updateTicketPriority,
  updateTicketStatus, fetchStaffComments, postStaffComment, fetchStaffNotes, postStaffNote,
  fetchStaffTicketAttachments,
  type StaffTicketDetailDto, type UserSummaryDto, type CommentDto, type InternalNoteDto, type AttachmentDto,
} from '../api/staffTickets';
import { ApiError } from '../api/tickets';
import { displayCommentBody } from '../lib/commentDisplay';
import { TicketStatusBadge, PriorityBadge } from '../components/TicketStatusBadge';
import { Icon } from '../components/Icon';

// Mirrors server/src/services/ticketStatusTransitions.ts exactly (specification.md §4.4) so an
// IT Staff member is never shown an option the server would reject (ui-spec.md §8).
const STATUS_TRANSITIONS: Record<string, string[]> = {
  NEW: ['CANCELLED'],
  OPEN: ['IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'CANCELLED'],
  IN_PROGRESS: ['WAITING_FOR_REQUESTER', 'RESOLVED'],
  WAITING_FOR_REQUESTER: ['IN_PROGRESS', 'RESOLVED', 'CANCELLED'],
  RESOLVED: ['CLOSED', 'REOPENED'],
  CLOSED: ['REOPENED'],
  REOPENED: ['OPEN'],
  CANCELLED: [],
};

const TERMINAL_STATUSES = new Set(['CLOSED', 'CANCELLED']);
const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

type SectionLoadState = 'loading' | 'loaded' | 'error';

export function StaffTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const ticketId = id as string;

  const [ticket, setTicket] = useState<StaffTicketDetailDto | null>(null);
  const [owners, setOwners] = useState<UserSummaryDto[]>([]);
  const [headerState, setHeaderState] = useState<SectionLoadState>('loading');

  const [comments, setComments] = useState<CommentDto[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentsState, setCommentsState] = useState<SectionLoadState>('loading');
  const [postingComment, setPostingComment] = useState(false);

  const [notes, setNotes] = useState<InternalNoteDto[]>([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [notesState, setNotesState] = useState<SectionLoadState>('loading');
  const [postingNote, setPostingNote] = useState(false);

  const [attachments, setAttachments] = useState<AttachmentDto[]>([]);
  const [attachmentsState, setAttachmentsState] = useState<SectionLoadState>('loading');

  // Per-control save-failure feedback (ui-spec.md:220-222: "shown as a small inline toast near
  // that control rather than a page-level banner, so acting on one control's result is never
  // confused with another's") -- same panelAlert-style convention AdminUserManagementPage.tsx
  // uses for its one-click actions, and the same headerState==='error'-style Retry affordance
  // this file already uses for the initial load.
  const [ownerError, setOwnerError] = useState('');
  const [lastOwnerAttempt, setLastOwnerAttempt] = useState('');
  const [priorityError, setPriorityError] = useState('');
  const [lastPriorityAttempt, setLastPriorityAttempt] = useState('');
  const [statusError, setStatusError] = useState('');
  const [lastStatusAttempt, setLastStatusAttempt] = useState('');

  const loadHeader = useCallback(() => {
    setHeaderState('loading');
    Promise.all([fetchStaffTicketDetail(ticketId), fetchAssignableOwners()])
      .then(([detail, ownerList]) => {
        setTicket(detail);
        setOwners(ownerList);
        setHeaderState('loaded');
      })
      .catch(() => setHeaderState('error'));
  }, [ticketId]);

  const loadComments = useCallback(() => {
    setCommentsState('loading');
    fetchStaffComments(ticketId).then((data) => { setComments(data); setCommentsState('loaded'); }).catch(() => setCommentsState('error'));
  }, [ticketId]);

  const loadNotes = useCallback(() => {
    setNotesState('loading');
    fetchStaffNotes(ticketId).then((data) => { setNotes(data); setNotesState('loaded'); }).catch(() => setNotesState('error'));
  }, [ticketId]);

  const loadAttachments = useCallback(() => {
    setAttachmentsState('loading');
    fetchStaffTicketAttachments(ticketId).then((data) => { setAttachments(data); setAttachmentsState('loaded'); }).catch(() => setAttachmentsState('error'));
  }, [ticketId]);

  useEffect(() => { loadHeader(); }, [loadHeader]);
  useEffect(() => { loadComments(); }, [loadComments]);
  useEffect(() => { loadNotes(); }, [loadNotes]);
  useEffect(() => { loadAttachments(); }, [loadAttachments]);

  async function handleOwnerChange(ownerId: string) {
    if (!ownerId) return;
    setLastOwnerAttempt(ownerId);
    setOwnerError('');
    try {
      const updated = await updateTicketOwner(ticketId, ownerId);
      setTicket(updated);
    } catch (error) {
      setOwnerError(error instanceof ApiError ? error.message : 'Failed to update owner.');
    }
  }

  async function handlePriorityChange(itPriority: string) {
    setLastPriorityAttempt(itPriority);
    setPriorityError('');
    try {
      const updated = await updateTicketPriority(ticketId, itPriority);
      setTicket(updated);
    } catch (error) {
      setPriorityError(error instanceof ApiError ? error.message : 'Failed to update IT Priority.');
    }
  }

  async function handleStatusChange(status: string) {
    setLastStatusAttempt(status);
    setStatusError('');
    try {
      const updated = await updateTicketStatus(ticketId, status);
      setTicket(updated);
    } catch (error) {
      setStatusError(error instanceof ApiError ? error.message : 'Failed to update status.');
    }
  }

  async function handlePostComment() {
    const trimmed = commentDraft.trim();
    if (!trimmed) return;
    setPostingComment(true);
    try {
      const created = await postStaffComment(ticketId, trimmed);
      setComments((prev) => [...prev, created]);
      setCommentDraft('');
    } finally {
      setPostingComment(false);
    }
  }

  async function handlePostNote() {
    const trimmed = noteDraft.trim();
    if (!trimmed) return;
    setPostingNote(true);
    try {
      const created = await postStaffNote(ticketId, trimmed);
      setNotes((prev) => [...prev, created]);
      setNoteDraft('');
    } finally {
      setPostingNote(false);
    }
  }

  if (headerState === 'loading') return <p aria-busy="true">Loading…</p>;
  if (headerState === 'error' || !ticket) {
    return (
      <div role="alert" className="alert alert-danger">
        <p>Ticket not found.</p>
        <button type="button" className="btn btn-outline-danger btn-sm" onClick={loadHeader}>Retry</button>
      </div>
    );
  }

  const statusOptions = STATUS_TRANSITIONS[ticket.status] ?? [];
  // Locked both pre-claim (BR-15: NEW + unowned, "assign an owner first") and on a terminal
  // status (BR-19: CLOSED/CANCELLED), matching priorityLocked's terminal-status check exactly
  // below rather than only handling the pre-claim case.
  const statusLocked = (ticket.status === 'NEW' && !ticket.owner) || TERMINAL_STATUSES.has(ticket.status);
  // Gates both Owner and IT Priority: BR-19 locks the whole ticket (not just one field) once it
  // reaches a terminal status.
  const ticketLocked = TERMINAL_STATUSES.has(ticket.status);

  return (
    <div>
      <h1>{ticket.ticketNo}</h1>
      <p>{ticket.summary}</p>
      <p>{ticket.description}</p>
      <p><strong>Requester:</strong> {ticket.requester.displayName}</p>
      <p><strong>Requested Priority:</strong> <PriorityBadge priority={ticket.requestedPriority} /></p>

      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <label htmlFor="staff-detail-owner" className="form-label">Ticket Owner</label>
          <select
            id="staff-detail-owner"
            className="form-select"
            value={ticket.owner?.id ?? ''}
            disabled={ticketLocked}
            title={ticketLocked ? 'Locked: ticket is Closed/Cancelled' : undefined}
            onChange={(event) => handleOwnerChange(event.target.value)}
          >
            {!ticket.owner && <option value="">Unassigned</option>}
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>{owner.displayName}</option>
            ))}
          </select>
          {ownerError && (
            <div role="alert" className="alert alert-danger alert-sm mt-1 p-2">
              <p className="mb-1">{ownerError}</p>
              <button
                type="button"
                className="btn btn-outline-danger btn-sm"
                onClick={() => handleOwnerChange(lastOwnerAttempt)}
              >
                Retry
              </button>
            </div>
          )}
        </div>

        <div className="col-md-4">
          <label htmlFor="staff-detail-priority" className="form-label">IT Priority</label>
          <select
            id="staff-detail-priority"
            className="form-select"
            value={ticket.itPriority}
            disabled={ticketLocked}
            title={ticketLocked ? 'Locked: ticket is Closed/Cancelled' : undefined}
            onChange={(event) => handlePriorityChange(event.target.value)}
          >
            {PRIORITY_OPTIONS.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
          {priorityError && (
            <div role="alert" className="alert alert-danger alert-sm mt-1 p-2">
              <p className="mb-1">{priorityError}</p>
              <button
                type="button"
                className="btn btn-outline-danger btn-sm"
                onClick={() => handlePriorityChange(lastPriorityAttempt)}
              >
                Retry
              </button>
            </div>
          )}
        </div>

        <div className="col-md-4">
          <label htmlFor="staff-detail-status" className="form-label">Current Status</label>
          <select
            id="staff-detail-status"
            className="form-select"
            value=""
            disabled={statusLocked}
            title={
              ticket.status === 'NEW' && !ticket.owner
                ? 'Assign an owner first'
                : TERMINAL_STATUSES.has(ticket.status)
                  ? 'Locked: ticket is Closed/Cancelled'
                  : undefined
            }
            onChange={(event) => handleStatusChange(event.target.value)}
          >
            {/* A real disabled placeholder option, not just an empty string default (N17): the
                option list below is transition *targets*, which by design excludes the ticket's
                own current status (specification.md §4.4) -- e.g. for a NEW, unassigned ticket
                the only target is CANCELLED. Without this placeholder, the browser falls back to
                visually selecting that lone option, so a New ticket's select would misleadingly
                display "CANCELLED" even though the ticket is not cancelled (the TicketStatusBadge
                just below already shows the real, correct status). Keeping the select -- rather
                than removing it -- matches ui-spec.md's description of this control as a "change
                to" action, not a second display of current status. */}
            <option value="" disabled>Select new status…</option>
            {statusOptions.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
          {statusError && (
            <div role="alert" className="alert alert-danger alert-sm mt-1 p-2">
              <p className="mb-1">{statusError}</p>
              <button
                type="button"
                className="btn btn-outline-danger btn-sm"
                onClick={() => handleStatusChange(lastStatusAttempt)}
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>

      <p><strong>Status:</strong> <TicketStatusBadge status={ticket.status} /></p>

      <section className="mb-4">
        <h2>Public Comments</h2>
        {commentsState === 'loading' && <p aria-busy="true">Loading comments…</p>}
        {commentsState === 'error' && (
          <div role="alert" className="alert alert-danger">
            <p>Failed to load comments.</p>
            <button type="button" className="btn btn-outline-danger btn-sm" onClick={loadComments}>Retry</button>
          </div>
        )}
        {commentsState === 'loaded' && comments.length === 0 && <p>No comments yet.</p>}
        {commentsState === 'loaded' && comments.map((comment) => {
          const { text, flagged } = displayCommentBody(comment.body);
          return (
            <div key={comment.id} className="border-bottom py-2">
              <strong>{comment.author.displayName}</strong>{' '}
              <span className="badge badge-tone-neutral">{comment.authorRole === 'REQUESTER' ? 'Requester' : 'IT Staff'}</span>{' '}
              <span className="text-body-secondary small">{new Date(comment.createdAt).toLocaleString()}</span>{' '}
              {flagged && (
                <span className="badge badge-tone-pale">
                  <Icon name="check-circle-fill" />
                  Problem Appears Resolved
                </span>
              )}
              <p className="mb-0">{text}</p>
            </div>
          );
        })}
        <textarea
          className="form-control mt-2"
          placeholder="Type your comment here…"
          value={commentDraft}
          onChange={(event) => setCommentDraft(event.target.value)}
          disabled={postingComment}
        />
        <button
          type="button"
          className="btn btn-primary btn-sm mt-2"
          disabled={commentDraft.trim().length === 0 || postingComment}
          onClick={handlePostComment}
        >
          Post Comment
        </button>
      </section>

      <section className="mb-4 p-3" style={{ background: '#FFF8E8' }}>
        <h2>Internal — visible only to IT Staff and Administrators</h2>
        {notesState === 'loading' && <p aria-busy="true">Loading notes…</p>}
        {notesState === 'error' && (
          <div role="alert" className="alert alert-danger">
            <p>Failed to load internal notes.</p>
            <button type="button" className="btn btn-outline-danger btn-sm" onClick={loadNotes}>Retry</button>
          </div>
        )}
        {notesState === 'loaded' && notes.length === 0 && <p>No internal notes yet.</p>}
        {notesState === 'loaded' && notes.map((note) => (
          <div key={note.id} className="border-bottom py-2">
            <strong>{note.author.displayName}</strong>{' '}
            <span className="text-body-secondary small">{new Date(note.createdAt).toLocaleString()}</span>
            <p className="mb-0">{note.body}</p>
          </div>
        ))}
        <textarea
          className="form-control mt-2"
          placeholder="Write an internal note…"
          value={noteDraft}
          onChange={(event) => setNoteDraft(event.target.value)}
          disabled={postingNote}
        />
        <button
          type="button"
          className="btn btn-primary btn-sm mt-2"
          disabled={noteDraft.trim().length === 0 || postingNote}
          onClick={handlePostNote}
        >
          Add Internal Note
        </button>
      </section>

      <section>
        <h2>Attachments</h2>
        {attachmentsState === 'loading' && <p aria-busy="true">Loading attachments…</p>}
        {attachmentsState === 'error' && (
          <div role="alert" className="alert alert-danger">
            <p>Failed to load attachments.</p>
            <button type="button" className="btn btn-outline-danger btn-sm" onClick={loadAttachments}>Retry</button>
          </div>
        )}
        {attachmentsState === 'loaded' && attachments.length === 0 && <p>No attachments.</p>}
        {attachmentsState === 'loaded' && attachments.map((attachment) => (
          <div key={attachment.id} className="d-flex justify-content-between border-bottom py-2">
            <span>{attachment.originalFilename}</span>
            {attachment.status === 'ACTIVE' && attachment.downloadUrl && (
              <a href={attachment.downloadUrl}>
                <Icon name="paperclip" /> Download
              </a>
            )}
            {attachment.status === 'REMOVED' && <span className="text-body-secondary">Removed</span>}
          </div>
        ))}
      </section>
    </div>
  );
}
