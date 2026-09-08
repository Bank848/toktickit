import { ApiError, type TicketListItemDto, type TicketDetailDto, type ListTicketsMeta } from './tickets';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export interface StaffTicketListItemDto extends TicketListItemDto {
  owner: { id: string; displayName: string } | null;
}
export type StaffTicketDetailDto = TicketDetailDto;

export interface UserSummaryDto {
  id: string;
  displayName: string;
  role: 'IT_STAFF' | 'ADMINISTRATOR';
}

export interface StaffListTicketsQuery {
  status?: string[];
  itPriority?: string | null;
  ownerId?: string | null;
  q?: string | null;
  page?: number;
  pageSize?: number;
  sort?: string;
}

export interface ListStaffTicketsResult {
  data: StaffTicketListItemDto[];
  meta: ListTicketsMeta;
}

async function throwApiError(response: Response, fallbackMessage: string): Promise<never> {
  const body = await response.json().catch(() => null);
  throw new ApiError(body?.error?.message ?? fallbackMessage, response.status, body?.error?.fieldErrors ?? []);
}

export async function fetchStaffTickets(query: StaffListTicketsQuery = {}): Promise<ListStaffTicketsResult> {
  const params = new URLSearchParams();
  for (const status of query.status ?? []) params.append('status', status);
  if (query.itPriority) params.set('itPriority', query.itPriority);
  if (query.ownerId) params.set('ownerId', query.ownerId);
  if (query.q) params.set('q', query.q);
  if (query.page !== undefined) params.set('page', String(query.page));
  if (query.pageSize !== undefined) params.set('pageSize', String(query.pageSize));
  if (query.sort !== undefined) params.set('sort', query.sort);

  const qs = params.toString();
  const response = await fetch(`${API_BASE_URL}/api/v1/staff/tickets${qs ? `?${qs}` : ''}`, {
    credentials: 'include',
  });
  if (!response.ok) return throwApiError(response, 'Failed to load the ticket queue');
  return response.json();
}

export async function fetchAssignableOwners(): Promise<UserSummaryDto[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/staff/assignable-owners`, { credentials: 'include' });
  if (!response.ok) return throwApiError(response, 'Failed to load assignable owners');
  return response.json();
}

export interface CommentDto {
  id: string; ticketId: string; body: string;
  author: { id: string; displayName: string };
  authorRole: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR';
  createdAt: string;
}
export type InternalNoteDto = CommentDto;

export interface AttachmentDto {
  id: string; originalFilename: string; mimeType: string; sizeBytes: number; createdAt: string;
  uploadedBy: { id: string; displayName: string };
  status: 'ACTIVE' | 'REMOVED';
  downloadUrl: string | null;
  removal: { reason: string | null; removedAt: string | null; removedBy: { id: string; displayName: string } | null } | null;
}

export async function fetchStaffTicketDetail(ticketId: string): Promise<StaffTicketDetailDto> {
  const response = await fetch(`${API_BASE_URL}/api/v1/staff/tickets/${ticketId}`, { credentials: 'include' });
  if (!response.ok) return throwApiError(response, 'Failed to load ticket');
  return response.json();
}

export async function updateTicketOwner(ticketId: string, ownerId: string): Promise<StaffTicketDetailDto> {
  const response = await fetch(`${API_BASE_URL}/api/v1/staff/tickets/${ticketId}/owner`, {
    method: 'PATCH', credentials: 'include',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ownerId }),
  });
  if (!response.ok) return throwApiError(response, 'Failed to update owner');
  return response.json();
}

export async function updateTicketPriority(ticketId: string, itPriority: string): Promise<StaffTicketDetailDto> {
  const response = await fetch(`${API_BASE_URL}/api/v1/staff/tickets/${ticketId}/priority`, {
    method: 'PATCH', credentials: 'include',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itPriority }),
  });
  if (!response.ok) return throwApiError(response, 'Failed to update IT Priority');
  return response.json();
}

export async function updateTicketStatus(ticketId: string, status: string): Promise<StaffTicketDetailDto> {
  const response = await fetch(`${API_BASE_URL}/api/v1/staff/tickets/${ticketId}/status`, {
    method: 'PATCH', credentials: 'include',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
  });
  if (!response.ok) return throwApiError(response, 'Failed to update status');
  return response.json();
}

export async function fetchStaffComments(ticketId: string): Promise<CommentDto[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/staff/tickets/${ticketId}/comments`, { credentials: 'include' });
  if (!response.ok) return throwApiError(response, 'Failed to load comments');
  return response.json();
}

export async function postStaffComment(ticketId: string, body: string): Promise<CommentDto> {
  const response = await fetch(`${API_BASE_URL}/api/v1/staff/tickets/${ticketId}/comments`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }),
  });
  if (!response.ok) return throwApiError(response, 'Failed to post comment');
  return response.json();
}

export async function fetchStaffNotes(ticketId: string): Promise<InternalNoteDto[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/staff/tickets/${ticketId}/notes`, { credentials: 'include' });
  if (!response.ok) return throwApiError(response, 'Failed to load internal notes');
  return response.json();
}

export async function postStaffNote(ticketId: string, body: string): Promise<InternalNoteDto> {
  const response = await fetch(`${API_BASE_URL}/api/v1/staff/tickets/${ticketId}/notes`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }),
  });
  if (!response.ok) return throwApiError(response, 'Failed to post internal note');
  return response.json();
}

export async function fetchStaffTicketAttachments(ticketId: string): Promise<AttachmentDto[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/staff/tickets/${ticketId}/attachments`, { credentials: 'include' });
  if (!response.ok) return throwApiError(response, 'Failed to load attachments');
  return response.json();
}
