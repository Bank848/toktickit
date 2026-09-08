import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { CommentSection } from '../../src/components/CommentSection';
import * as commentsApi from '../../src/api/comments';
import { ApiError } from '../../src/api/tickets';
import type { CommentDto } from '../../src/api/comments';

const TICKET_ID = 'tkt-1';

function comment(overrides: Partial<CommentDto> = {}): CommentDto {
  return {
    id: 'c-1',
    ticketId: TICKET_ID,
    body: 'Any update on this?',
    author: { id: 'req-1', displayName: 'Ariya' },
    createdAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('CommentSection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows an empty state when there are zero comments', async () => {
    vi.spyOn(commentsApi, 'fetchComments').mockResolvedValue([]);
    render(<CommentSection ticketId={TICKET_ID} />);
    await waitFor(() => {
      expect(screen.getByText(/no comments yet/i)).toBeInTheDocument();
    });
  });

  it('renders author, timestamp, and body for each comment, oldest first order as given by the API', async () => {
    vi.spyOn(commentsApi, 'fetchComments').mockResolvedValue([
      comment({ id: 'c-1', body: 'First message' }),
      comment({ id: 'c-2', body: 'Second message', author: { id: 'req-2', displayName: 'Narin' } }),
    ]);
    render(<CommentSection ticketId={TICKET_ID} />);

    await waitFor(() => {
      expect(screen.getByText('First message')).toBeInTheDocument();
    });
    const rows = screen.getAllByTestId('comment-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Ariya');
    expect(rows[1]).toHaveTextContent('Narin');
  });

  it('renders the flagged badge and strips the raw marker prefix from displayed text', async () => {
    vi.spyOn(commentsApi, 'fetchComments').mockResolvedValue([
      comment({ body: '[Requester marked: problem appears resolved] Fixed now, thanks!' }),
    ]);
    render(<CommentSection ticketId={TICKET_ID} />);

    await waitFor(() => {
      expect(screen.getByText('Fixed now, thanks!')).toBeInTheDocument();
    });
    // Scoped to the comment row: the always-rendered "problem appears resolved" checkbox
    // label below the list also matches this regex, so an unscoped query is ambiguous.
    const row = screen.getByTestId('comment-row');
    expect(within(row).getByText(/problem appears resolved/i)).toBeInTheDocument();
    expect(screen.queryByText(/\[Requester marked/)).not.toBeInTheDocument();
  });

  it('shows an inline error with Retry when the comment list fetch fails', async () => {
    const fetchSpy = vi
      .spyOn(commentsApi, 'fetchComments')
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce([]);
    render(<CommentSection ticketId={TICKET_ID} />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => {
      expect(screen.getByText(/no comments yet/i)).toBeInTheDocument();
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('disables Post Comment while the textarea is empty or whitespace-only', async () => {
    vi.spyOn(commentsApi, 'fetchComments').mockResolvedValue([]);
    render(<CommentSection ticketId={TICKET_ID} />);
    await waitFor(() => screen.getByText(/no comments yet/i));

    expect(screen.getByRole('button', { name: /post comment/i })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/post a comment/i), { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: /post comment/i })).toBeDisabled();
  });

  it('posts the comment with problemAppearsResolved set, appends it, and resets the form on success', async () => {
    vi.spyOn(commentsApi, 'fetchComments').mockResolvedValue([]);
    const postSpy = vi.spyOn(commentsApi, 'postComment').mockResolvedValue(
      comment({ id: 'c-new', body: '[Requester marked: problem appears resolved] All good now' }),
    );
    render(<CommentSection ticketId={TICKET_ID} />);
    await waitFor(() => screen.getByText(/no comments yet/i));

    fireEvent.change(screen.getByLabelText(/post a comment/i), { target: { value: 'All good now' } });
    fireEvent.click(screen.getByLabelText(/problem appears resolved/i));
    fireEvent.click(screen.getByRole('button', { name: /post comment/i }));

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith(TICKET_ID, { body: 'All good now', problemAppearsResolved: true });
    });
    await waitFor(() => {
      expect(screen.getByText('All good now')).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/post a comment/i)).toHaveValue('');
    expect(screen.getByLabelText(/problem appears resolved/i)).not.toBeChecked();
  });

  it('shows a dismissible error and preserves the typed draft when posting fails', async () => {
    vi.spyOn(commentsApi, 'fetchComments').mockResolvedValue([]);
    vi.spyOn(commentsApi, 'postComment').mockRejectedValue(new ApiError('Failed to post comment', 500));
    render(<CommentSection ticketId={TICKET_ID} />);
    await waitFor(() => screen.getByText(/no comments yet/i));

    fireEvent.change(screen.getByLabelText(/post a comment/i), { target: { value: 'Draft that should survive' } });
    fireEvent.click(screen.getByRole('button', { name: /post comment/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/post a comment/i)).toHaveValue('Draft that should survive');

    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
