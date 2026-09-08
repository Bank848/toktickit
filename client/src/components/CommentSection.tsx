import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { fetchComments, postComment, type CommentDto } from '../api/comments';
import { ApiError } from '../api/tickets';
import { Icon } from './Icon';

// Must match the server's literal in server/src/routes/v1/comments.ts exactly (A-08) -- this
// is a display-only parse, never sent back to the server as literal text.
const PROBLEM_RESOLVED_PREFIX = '[Requester marked: problem appears resolved] ';
const MAX_COMMENT_LENGTH = 2000;

interface Props {
  ticketId: string;
}

type ListState = 'loading' | 'loaded' | 'error';

function displayBody(body: string): { text: string; flagged: boolean } {
  if (body.startsWith(PROBLEM_RESOLVED_PREFIX)) {
    return { text: body.slice(PROBLEM_RESOLVED_PREFIX.length), flagged: true };
  }
  return { text: body, flagged: false };
}

export function CommentSection({ ticketId }: Props) {
  const [comments, setComments] = useState<CommentDto[]>([]);
  const [listState, setListState] = useState<ListState>('loading');
  const [draftBody, setDraftBody] = useState('');
  const [problemAppearsResolved, setProblemAppearsResolved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const loadComments = useCallback(() => {
    setListState('loading');
    fetchComments(ticketId)
      .then((data) => {
        setComments(data);
        setListState('loaded');
      })
      .catch(() => {
        setListState('error');
      });
  }, [ticketId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const trimmedDraft = draftBody.trim();
  const postDisabled = submitting || trimmedDraft.length === 0 || trimmedDraft.length > MAX_COMMENT_LENGTH;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (postDisabled) return;

    setSubmitting(true);
    setSubmitError('');
    try {
      const created = await postComment(ticketId, { body: trimmedDraft, problemAppearsResolved });
      setComments((prev) => [...prev, created]);
      setDraftBody('');
      setProblemAppearsResolved(false);
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : 'Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="comments-heading">
      <h2 id="comments-heading">Public Comments</h2>

      {listState === 'loading' && (
        <p className="text-body-secondary d-flex align-items-center gap-2">
          <span className="spinner-border spinner-border-sm" aria-hidden="true" /> Loading comments…
        </p>
      )}

      {listState === 'error' && (
        <div role="alert" className="alert alert-danger">
          <Icon name="exclamation-triangle-fill" />
          <div>
            <p>Failed to load comments.</p>
            <button type="button" className="btn btn-outline-danger btn-sm" onClick={loadComments}>
              <Icon name="arrow-repeat" className="me-1" />
              Retry
            </button>
          </div>
        </div>
      )}

      {listState === 'loaded' && comments.length === 0 && (
        <p className="text-body-secondary">No comments yet.</p>
      )}

      {listState === 'loaded' && comments.length > 0 && (
        <ul className="list-unstyled comment-list">
          {comments.map((c) => {
            const { text, flagged } = displayBody(c.body);
            return (
              <li key={c.id} data-testid="comment-row" className="comment-row">
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <strong>{c.author.displayName}</strong>
                  <span className="badge badge-tone-neutral">{c.authorRole === 'REQUESTER' ? 'Requester' : 'IT Staff'}</span>
                  <span className="text-body-secondary small">{new Date(c.createdAt).toLocaleString()}</span>
                  {flagged && (
                    <span className="badge badge-tone-pale">
                      <Icon name="check-circle-fill" />
                      Problem Appears Resolved
                    </span>
                  )}
                </div>
                <p style={{ whiteSpace: 'pre-wrap' }}>{text}</p>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="mt-3">
        <label htmlFor="comment-body-input" className="form-label">
          Post a comment
        </label>
        <textarea
          id="comment-body-input"
          className="form-control"
          placeholder="Type your comment here…"
          maxLength={MAX_COMMENT_LENGTH}
          disabled={submitting}
          value={draftBody}
          onChange={(event) => setDraftBody(event.target.value)}
        />
        {trimmedDraft.length > 1800 && (
          <p className="form-text mb-0">
            {trimmedDraft.length} / {MAX_COMMENT_LENGTH}
          </p>
        )}

        <div className="form-check mt-2">
          <input
            id="problem-appears-resolved-checkbox"
            type="checkbox"
            className="form-check-input"
            checked={problemAppearsResolved}
            disabled={submitting}
            onChange={(event) => setProblemAppearsResolved(event.target.checked)}
          />
          <label htmlFor="problem-appears-resolved-checkbox" className="form-check-label">
            This also indicates the reported problem appears resolved
          </label>
        </div>

        {submitError && (
          <div role="alert" className="alert alert-danger alert-dismissible mt-2">
            <Icon name="exclamation-triangle-fill" />
            <p className="mb-0">{submitError}</p>
            <button type="button" className="btn-close" aria-label="Dismiss" onClick={() => setSubmitError('')} />
          </div>
        )}

        <button type="submit" className="btn btn-primary mt-2" disabled={postDisabled} aria-busy={submitting}>
          {submitting && <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />}
          Post Comment
        </button>
      </form>
    </section>
  );
}
