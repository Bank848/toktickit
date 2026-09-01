const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export function authHeaders(requesterId: string): HeadersInit {
  return { 'x-dev-user-id': requesterId, 'Content-Type': 'application/json' };
}

export interface FieldError {
  field: string;
  message: string;
}

// Thrown by every tickets/attachments API call that receives a non-ok response. Carries the
// server's status and fieldErrors (when present, e.g. a 422) so callers -- CreateTicketPage in
// particular, per FR-11's "map fieldErrors onto the form" -- can react to more than just a
// message string. A plain Error would lose that structured detail.
export class ApiError extends Error {
  status: number;
  fieldErrors: FieldError[];

  constructor(message: string, status: number, fieldErrors: FieldError[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export interface CreateTicketPayload {
  summary: string;
  description: string;
  categoryId: number;
  relatedSystemId: number | null;
  requestedPriority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

export interface TicketDetailDto {
  id: string;
  ticketNo: string;
  summary: string;
  description: string;
  category: { id: number; name: string };
  relatedSystem: { id: number; name: string } | null;
  status: string;
  requestedPriority: string;
  itPriority: string;
  createdAt: string;
  updatedAt: string;
  attachmentCount: number;
  requester: { id: string; displayName: string };
  owner: { id: string; displayName: string } | null;
  resolutionSummary: string | null;
  version: number;
}

async function throwApiError(response: Response, fallbackMessage: string): Promise<never> {
  const body = await response.json().catch(() => null);
  throw new ApiError(body?.error?.message ?? fallbackMessage, response.status, body?.error?.fieldErrors ?? []);
}

export async function createTicket(
  requesterId: string,
  payload: CreateTicketPayload,
): Promise<TicketDetailDto> {
  const response = await fetch(`${API_BASE_URL}/api/v1/tickets`, {
    method: 'POST',
    headers: authHeaders(requesterId),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    return throwApiError(response, 'Failed to create ticket');
  }
  return response.json();
}
