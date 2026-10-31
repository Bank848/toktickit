import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  fetchStaffActions, postStaffAction, updateStaffAction, ActionApiError,
  type ActionTakenDto, type ActionResult,
} from '../api/staffActions';
import { toDatetimeLocalValue, fromDatetimeLocalValue } from '../lib/datetimeLocal';
import { newIdempotencyKey } from '../lib/idempotencyKey';

const RESULT_OPTIONS: { value: ActionResult; label: string }[] = [
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'ESCALATED', label: 'Escalated' },
  { value: 'NO_ACTION_NEEDED', label: 'No Action Needed' },
  { value: 'PENDING_FOLLOW_UP', label: 'Pending Follow-Up' },
];

const LOCKED_MESSAGE = 'This ticket is Closed or Cancelled, so Actions Taken can no longer be recorded or edited.';
const STALE_MESSAGE = 'This record was changed by someone else. Reload to see the latest version.';
const PRECONDITION_MESSAGE = 'The save could not be checked against the latest version. Reload and try again.';
const KEY_REUSED_MESSAGE =
  'An earlier attempt of this form may already have been saved with different text. Reload to check the list before saving again.';
const NETWORK_MESSAGE = 'Could not reach the server. Your entries are kept. Press Save to try again.';

interface Props {
  ticketId: string;
  ticketLocked: boolean;
}

type ListState = 'loading' | 'loaded' | 'error';
type FormMode = 'closed' | 'create' | { editId: string };
// Decides whether the alert shows a Reload button.
type ErrorKind = 'generic' | 'stale' | 'keyReused' | 'precondition' | 'locked';

interface Draft {
  actionAt: string;
  description: string;
  result: ActionResult;
  followUpRequired: boolean;
  followUpNote: string;
  attachmentNotes: string;
}

function emptyDraft(): Draft {
  return {
    actionAt: toDatetimeLocalValue(new Date().toISOString()),
    description: '', result: 'RESOLVED', followUpRequired: false, followUpNote: '', attachmentNotes: '',
  };
}

function draftFromAction(action: ActionTakenDto): Draft {
  return {
    actionAt: toDatetimeLocalValue(action.actionAt), description: action.description, result: action.result,
    followUpRequired: action.followUpRequired, followUpNote: action.followUpNote ?? '', attachmentNotes: action.attachmentNotes ?? '',
  };
}

export function ActionsTakenSection({ ticketId, ticketLocked }: Props) {
  const [actions, setActions] = useState<ActionTakenDto[]>([]);
  const [listState, setListState] = useState<ListState>('loading');
  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [errorKind, setErrorKind] = useState<ErrorKind>('generic');
  const [reloading, setReloading] = useState(false);
  const [serverLocked, setServerLocked] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [descriptionTouched, setDescriptionTouched] = useState(false);

  // Synchronous guard: state updates are batched, so two quick clicks could both pass `submitting`.
  const submittingRef = useRef(false);
  // One Idempotency-Key per open create form. Set when the form opens, kept across every retry,
  // cleared after a successful save or when the form closes. Never generated per click.
  const idempotencyKeyRef = useRef<string | null>(null);
  // The etag of the record being edited, as it was in the list when Edit was pressed.
  const editEtagRef = useRef<string | null>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  const locked = ticketLocked || serverLocked;

  const loadActions = useCallback(() => {
    setListState('loading');
    return fetchStaffActions(ticketId)
      .then((data) => { setActions(data); setListState('loaded'); return data; })
      .catch(() => { setListState('error'); return null; });
  }, [ticketId]);

  useEffect(() => { loadActions(); }, [loadActions]);

  useEffect(() => {
    if (formMode !== 'closed') descriptionRef.current?.focus();
  }, [formMode]);

  function resetFormFeedback() {
    setSubmitError('');
    setErrorKind('generic');
    setDescriptionTouched(false);
  }

  function closeForm() {
    idempotencyKeyRef.current = null;
    editEtagRef.current = null;
    resetFormFeedback();
    setFormMode('closed');
  }

  function openCreate() {
    idempotencyKeyRef.current = newIdempotencyKey();
    editEtagRef.current = null;
    setStatusMessage('');
    setDraft(emptyDraft());
    resetFormFeedback();
    setFormMode('create');
  }

  function openEdit(action: ActionTakenDto) {
    idempotencyKeyRef.current = null;
    editEtagRef.current = action.etag;
    setStatusMessage('');
    setDraft(draftFromAction(action));
    resetFormFeedback();
    setFormMode({ editId: action.id });
  }

  const followUpNoteInvalid = draft.followUpRequired && draft.followUpNote.trim().length === 0;
  const descriptionInvalid = draft.description.trim().length === 0;
  const actionAtInvalid = draft.actionAt.trim().length === 0;
  const saveDisabled = locked || submitting || descriptionInvalid || followUpNoteInvalid || actionAtInvalid;

  function upsert(saved: ActionTakenDto) {
    // A new record goes at the end (the list is oldest first); an edited one is replaced in place.
    setActions((prev) => (prev.some((a) => a.id === saved.id)
      ? prev.map((a) => (a.id === saved.id ? saved : a))
      : [...prev, saved]));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (formMode === 'closed' || saveDisabled || submittingRef.current) return;

    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError('');
    setErrorKind('generic');
    try {
      // Built inside the try block so a malformed date becomes a form error, not a stuck spinner.
      const payload = {
        actionAt: fromDatetimeLocalValue(draft.actionAt),
        description: draft.description.trim(),
        result: draft.result,
        followUpRequired: draft.followUpRequired,
        followUpNote: draft.followUpRequired ? draft.followUpNote.trim() : undefined,
        attachmentNotes: draft.attachmentNotes.trim() || undefined,
      };
      if (formMode === 'create') {
        const key = idempotencyKeyRef.current ?? (idempotencyKeyRef.current = newIdempotencyKey());
        upsert(await postStaffAction(ticketId, payload, key));
        setStatusMessage('Action Taken recorded.');
      } else {
        upsert(await updateStaffAction(ticketId, formMode.editId, payload, editEtagRef.current ?? ''));
        setStatusMessage('Action Taken updated.');
      }
      closeForm();
    } catch (error) {
      if (error instanceof ActionApiError) {
        if (error.status === 409 && error.code === 'TICKET_LOCKED') {
          setServerLocked(true);
          setErrorKind('locked');
          setSubmitError(LOCKED_MESSAGE);
        } else if (error.status === 409 && error.code === 'STALE_UPDATE') {
          setErrorKind('stale');
          setSubmitError(STALE_MESSAGE);
        } else if (error.status === 409 && error.code === 'IDEMPOTENCY_KEY_REUSED') {
          setErrorKind('keyReused');
          setSubmitError(KEY_REUSED_MESSAGE);
        } else if (error.status === 428) {
          setErrorKind('precondition');
          setSubmitError(PRECONDITION_MESSAGE);
        } else {
          setSubmitError(error.message);
        }
      } else if (error instanceof TypeError) {
        setSubmitError(NETWORK_MESSAGE);
      } else {
        setSubmitError('Failed to save Action Taken');
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  // Reload refetches the list and keeps what the user typed. The user has now been shown the latest
  // list, so the next Save uses the latest etag (edit), or a fresh Idempotency-Key (create after
  // IDEMPOTENCY_KEY_REUSED, where the earlier attempt may or may not be in the list).
  async function handleReload() {
    setReloading(true);
    const data = await loadActions();
    setReloading(false);
    if (!data) return;
    if (formMode !== 'closed' && formMode !== 'create') {
      const latest = data.find((a) => a.id === formMode.editId);
      if (latest) editEtagRef.current = latest.etag;
    }
    if (formMode === 'create' && errorKind === 'keyReused') {
      idempotencyKeyRef.current = newIdempotencyKey();
    }
    setErrorKind('generic');
    setSubmitError('');
    setStatusMessage('List reloaded. Check the latest records above, then press Save to apply your entry.');
  }

  const showDescriptionError = descriptionInvalid && descriptionTouched;
  const showReload = errorKind === 'stale' || errorKind === 'keyReused' || errorKind === 'precondition';

  return (
    <section aria-labelledby="actions-taken-heading">
      <div className="d-flex justify-content-between align-items-center">
        <h2 id="actions-taken-heading">Actions Taken</h2>
        {formMode === 'closed' && (
          <button type="button" className="btn btn-primary btn-sm" disabled={locked} onClick={openCreate}>
            Record Action Taken
          </button>
        )}
      </div>

      {locked && (
        <p className="text-body-secondary small">
          This ticket is Closed or Cancelled. Actions Taken stay visible but can no longer be recorded or edited.
        </p>
      )}

      <div role="status" aria-live="polite" className="small text-body-secondary">{statusMessage}</div>

      {listState === 'loading' && <p aria-busy="true">Loading Actions Taken…</p>}
      {listState === 'error' && (
        <div role="alert" className="alert alert-danger">
          <p>Failed to load Actions Taken.</p>
          <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => { loadActions(); }}>Retry</button>
        </div>
      )}
      {listState === 'loaded' && actions.length === 0 && <p className="text-body-secondary">No Actions Taken yet.</p>}
      {listState === 'loaded' && actions.map((a) => (
        <div key={a.id} data-testid="action-row" className="border-bottom py-2">
          <div className="d-flex flex-wrap align-items-center gap-2">
            <strong>{a.performedBy.displayName}</strong>
            <span className="badge badge-tone-neutral">{RESULT_OPTIONS.find((r) => r.value === a.result)?.label ?? a.result}</span>
            <time className="text-body-secondary small" dateTime={a.actionAt}>{new Date(a.actionAt).toLocaleString()}</time>
            {a.followUpRequired && <span className="badge badge-tone-pale">Follow-Up Required</span>}
            <button
              type="button" className="btn btn-outline-secondary btn-sm ms-auto" disabled={locked}
              aria-label={`Edit Action Taken by ${a.performedBy.displayName}`} onClick={() => openEdit(a)}
            >
              Edit
            </button>
          </div>
          <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>{a.description}</p>
          {a.followUpNote && <p className="mb-0 text-body-secondary small">Follow-up: {a.followUpNote}</p>}
          {a.attachmentNotes && <p className="mb-0 text-body-secondary small">Attachment: {a.attachmentNotes}</p>}
          {a.lastEditedBy && <p className="mb-0 text-body-secondary small">Edited by {a.lastEditedBy.displayName}</p>}
        </div>
      ))}

      {formMode !== 'closed' && (
        <form
          onSubmit={handleSubmit} className="mt-3" noValidate
          aria-label={formMode === 'create' ? 'Record Action Taken' : 'Edit Action Taken'}
        >
          <p className="small text-body-secondary mb-2"><span aria-hidden="true">*</span> Required field</p>

          <label htmlFor="action-taken-date" className="form-label">
            Action Date/Time <span aria-hidden="true">*</span>
          </label>
          <input
            id="action-taken-date" type="datetime-local" className="form-control"
            required aria-required="true" aria-invalid={actionAtInvalid}
            aria-describedby={actionAtInvalid ? 'action-taken-date-error' : undefined}
            value={draft.actionAt} disabled={submitting}
            onChange={(e) => setDraft((d) => ({ ...d, actionAt: e.target.value }))}
          />
          {actionAtInvalid && (
            <div id="action-taken-date-error" className="form-text text-danger">Enter the date and time of the action.</div>
          )}

          <label htmlFor="action-taken-description" className="form-label mt-2">
            Description <span aria-hidden="true">*</span>
          </label>
          <textarea
            id="action-taken-description" ref={descriptionRef} className="form-control" maxLength={2000} disabled={submitting}
            required aria-required="true" aria-invalid={showDescriptionError}
            aria-describedby={showDescriptionError ? 'action-taken-description-error' : undefined}
            value={draft.description} onBlur={() => setDescriptionTouched(true)}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          />
          {showDescriptionError && (
            <div id="action-taken-description-error" className="form-text text-danger">Description is required.</div>
          )}

          <label htmlFor="action-taken-result" className="form-label mt-2">
            Result <span aria-hidden="true">*</span>
          </label>
          <select
            id="action-taken-result" className="form-select" disabled={submitting} required aria-required="true"
            value={draft.result} onChange={(e) => setDraft((d) => ({ ...d, result: e.target.value as ActionResult }))}
          >
            {RESULT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <div className="form-check mt-2">
            <input
              id="action-taken-followup" type="checkbox" className="form-check-input" disabled={submitting}
              checked={draft.followUpRequired}
              onChange={(e) => setDraft((d) => ({ ...d, followUpRequired: e.target.checked }))}
            />
            <label htmlFor="action-taken-followup" className="form-check-label">Follow-Up Required</label>
          </div>
          {draft.followUpRequired && (
            <>
              <label htmlFor="action-taken-followup-note" className="form-label mt-2">
                Follow-up Note <span aria-hidden="true">*</span>
              </label>
              <textarea
                id="action-taken-followup-note" className="form-control" maxLength={1000} disabled={submitting}
                required aria-required="true" aria-invalid={followUpNoteInvalid}
                aria-describedby={followUpNoteInvalid ? 'action-taken-followup-note-error' : undefined}
                value={draft.followUpNote} onChange={(e) => setDraft((d) => ({ ...d, followUpNote: e.target.value }))}
              />
              {followUpNoteInvalid && (
                <div id="action-taken-followup-note-error" className="form-text text-danger">
                  A Follow-up Note is required when Follow-Up Required is checked.
                </div>
              )}
            </>
          )}

          <label htmlFor="action-taken-attachment-notes" className="form-label mt-2">Attachment Notes (optional)</label>
          <input
            id="action-taken-attachment-notes" type="text" className="form-control" maxLength={500} disabled={submitting}
            aria-describedby="action-taken-attachment-help"
            value={draft.attachmentNotes} onChange={(e) => setDraft((d) => ({ ...d, attachmentNotes: e.target.value }))}
          />
          <div id="action-taken-attachment-help" className="form-text">
            Plain text pointing to a file kept elsewhere. No file is uploaded.
          </div>

          {submitError && (
            <div role="alert" className="alert alert-danger mt-2">
              <p className="mb-0">{submitError}</p>
              {showReload && (
                <button type="button" className="btn btn-outline-danger btn-sm mt-2" disabled={reloading} onClick={handleReload}>
                  Reload
                </button>
              )}
            </div>
          )}

          <div className="mt-2 d-flex gap-2">
            <button type="submit" className="btn btn-primary btn-sm" disabled={saveDisabled} aria-busy={submitting}>Save</button>
            <button type="button" className="btn btn-outline-secondary btn-sm" disabled={submitting} onClick={closeForm}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
