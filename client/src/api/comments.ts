import { ApiError } from './tickets';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export interface CommentAuthorDto {
  id: string;
  displayName: string;
}

export interface CommentDto {
  id: string;
  ticketId: string;
  body: string;
  author: CommentAuthorDto;
  authorRole: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR';
  createdAt: string;
}

export interface PostCommentPayload {
  body: string;
  problemAppearsResolved?: boolean;
}

async function throwCommentError(response: Response, fallbackMessage: string): Promise<never> {
  const body = await response.json().catch(() => null);
  throw new ApiError(body?.error?.message ?? fallbackMessage, response.status, body?.error?.fieldErrors ?? []);
}

// No identity header/param here on purpose -- api-spec.md's session cookie carries identity,
// and Public Comments have no per-caller ownership affordance the client needs to know about
// (see this plan's "client-side scope note").
export async function fetchComments(ticketId: string): Promise<CommentDto[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/tickets/${ticketId}/comments`, {
    credentials: 'include',
  });
  if (!response.ok) {
    return throwCommentError(response, 'Failed to load comments');
  }
  return response.json();
}

export async function postComment(ticketId: string, payload: PostCommentPayload): Promise<CommentDto> {
  const response = await fetch(`${API_BASE_URL}/api/v1/tickets/${ticketId}/comments`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    return throwCommentError(response, 'Failed to post comment');
  }
  return response.json();
}
