import { ApiError } from './tickets';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export type ActionResult = 'RESOLVED' | 'ESCALATED' | 'NO_ACTION_NEEDED' | 'PENDING_FOLLOW_UP';

// Matches ActionTakenDto from server/src/services/actionTaken.ts (serializeAction). All times are UTC ISO strings.
export interface ActionTakenDto {
  id: string;
  ticketId: string;
  performedBy: { id: string; displayName: string };
  lastEditedBy: { id: string; displayName: string } | null;
  actionAt: string;
  description: string;
  result: ActionResult;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
  // Quoted ISO updatedAt (api-spec.md 4.4). Sent back as the If-Match header on edit, unchanged.
  etag: string;
  createdAt: string;
  updatedAt: string;
}

// ApiError plus the server's machine-readable error code, so callers branch on the code and never on message text.
export class ActionApiError extends ApiError {
  code: string | undefined;

  constructor(message: string, status: number, fieldErrors: ApiError['fieldErrors'], code: string | undefined) {
    super(message, status, fieldErrors);
    this.name = 'ActionApiError';
    this.code = code;
  }
}

export async function throwActionApiError(response: Response, fallbackMessage: string): Promise<never> {
  const body = await response.json().catch(() => null);
  throw new ActionApiError(
    body?.error?.message ?? fallbackMessage, response.status, body?.error?.fieldErrors ?? [], body?.error?.code,
  );
}

// Requester read-only list (GET /api/v1/tickets/:id/actions). Oldest first, as the server returns it.
export async function fetchActions(ticketId: string): Promise<ActionTakenDto[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/tickets/${ticketId}/actions`, { credentials: 'include' });
  if (!response.ok) return throwActionApiError(response, 'Failed to load Actions Taken');
  return response.json();
}
