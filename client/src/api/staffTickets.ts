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
