import { useCallback, useEffect, useState } from 'react';
import { fetchActions, type ActionTakenDto } from '../api/actions';

const RESULT_LABELS: Record<string, string> = {
  RESOLVED: 'Resolved', ESCALATED: 'Escalated', NO_ACTION_NEEDED: 'No Action Needed', PENDING_FOLLOW_UP: 'Pending Follow-Up',
};

interface Props {
  ticketId: string;
}

type ListState = 'loading' | 'loaded' | 'error';

// Requester view (ui-spec.md section 5): same record layout as the staff section, no controls.
export function ActionsTakenReadOnlySection({ ticketId }: Props) {
  const [actions, setActions] = useState<ActionTakenDto[]>([]);
  const [listState, setListState] = useState<ListState>('loading');

  const loadActions = useCallback(() => {
    setListState('loading');
    fetchActions(ticketId).then((data) => { setActions(data); setListState('loaded'); }).catch(() => setListState('error'));
  }, [ticketId]);

  useEffect(() => { loadActions(); }, [loadActions]);

  return (
    <section aria-labelledby="actions-taken-readonly-heading">
      <h2 id="actions-taken-readonly-heading">Actions Taken</h2>

      {listState === 'loading' && <p aria-busy="true">Loading Actions Taken…</p>}
      {listState === 'error' && (
        <div role="alert" className="alert alert-danger">
          <p>Failed to load Actions Taken.</p>
          <button type="button" className="btn btn-outline-danger btn-sm" onClick={loadActions}>Retry</button>
        </div>
      )}
      {listState === 'loaded' && actions.length === 0 && <p className="text-body-secondary">No Actions Taken yet.</p>}
      {listState === 'loaded' && actions.map((a) => (
        <div key={a.id} data-testid="action-row-readonly" className="border-bottom py-2">
          <div className="d-flex flex-wrap align-items-center gap-2">
            <strong>{a.performedBy.displayName}</strong>
            <span className="badge badge-tone-neutral">{RESULT_LABELS[a.result] ?? a.result}</span>
            <time className="text-body-secondary small" dateTime={a.actionAt}>{new Date(a.actionAt).toLocaleString()}</time>
            {a.followUpRequired && <span className="badge badge-tone-pale">Follow-Up Required</span>}
          </div>
          <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>{a.description}</p>
          {a.followUpNote && <p className="mb-0 text-body-secondary small">Follow-up: {a.followUpNote}</p>}
          {a.attachmentNotes && <p className="mb-0 text-body-secondary small">Attachment: {a.attachmentNotes}</p>}
          {a.lastEditedBy && <p className="mb-0 text-body-secondary small">Edited by {a.lastEditedBy.displayName}</p>}
        </div>
      ))}
    </section>
  );
}
