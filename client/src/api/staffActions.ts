import { throwActionApiError, type ActionResult, type ActionTakenDto } from './actions';

export { ActionApiError } from './actions';
export type { ActionResult, ActionTakenDto } from './actions';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

// Body of create and edit. performedById is deliberately absent: the server takes the performer
// from the session (api-spec.md 4.1). actionAt is a UTC ISO 8601 string ending in Z.
export interface ActionTakenPayload {
  actionAt: string;
  description: string;
  result: ActionResult;
  followUpRequired: boolean;
  followUpNote?: string;
  attachmentNotes?: string;
}

export async function fetchStaffActions(ticketId: string): Promise<ActionTakenDto[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/staff/tickets/${ticketId}/actions`, { credentials: 'include' });
  if (!response.ok) return throwActionApiError(response, 'Failed to load Actions Taken');
  return response.json();
}

// 201 for a new record, 200 when the server replays a stored record for the same Idempotency-Key. Both are success.
export async function postStaffAction(
  ticketId: string, payload: ActionTakenPayload, idempotencyKey: string,
): Promise<ActionTakenDto> {
  const response = await fetch(`${API_BASE_URL}/api/v1/staff/tickets/${ticketId}/actions`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(payload),
  });
  if (!response.ok) return throwActionApiError(response, 'Failed to save Action Taken');
  return response.json();
}

// `etag` is the record's own etag field, passed through as the If-Match value without changes.
export async function updateStaffAction(
  ticketId: string, actionId: string, payload: ActionTakenPayload, etag: string,
): Promise<ActionTakenDto> {
  const response = await fetch(`${API_BASE_URL}/api/v1/staff/tickets/${ticketId}/actions/${actionId}`, {
    method: 'PATCH', credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'If-Match': etag },
    body: JSON.stringify(payload),
  });
  if (!response.ok) return throwActionApiError(response, 'Failed to save Action Taken');
  return response.json();
}
