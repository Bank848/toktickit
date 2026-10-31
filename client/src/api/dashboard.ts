import { ApiError } from './tickets';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export interface RecentTicketDto {
  id: string;
  ticketNo: string;
  summary: string;
  status: string;
  updatedAt: string;
}

export interface RequesterDashboardDto {
  statusCounts: Record<string, number>;
  recentTickets: RecentTicketDto[];
}

export interface StaffDashboardDto {
  unassignedCount: number;
  ownedByMeCount: number;
  statusCounts: Record<string, number>;
  priorityCounts: Record<string, number>;
  recentTickets: RecentTicketDto[];
  userCounts?: Record<string, number>;
}

async function throwApiError(response: Response, fallbackMessage: string): Promise<never> {
  const body = await response.json().catch(() => null);
  throw new ApiError(body?.error?.message ?? fallbackMessage, response.status, body?.error?.fieldErrors ?? []);
}

export async function fetchRequesterDashboard(): Promise<RequesterDashboardDto> {
  const response = await fetch(`${API_BASE_URL}/api/v1/dashboard`, { credentials: 'include' });
  if (!response.ok) return throwApiError(response, 'Failed to load your dashboard');
  return response.json();
}

export async function fetchStaffDashboard(): Promise<StaffDashboardDto> {
  const response = await fetch(`${API_BASE_URL}/api/v1/staff/dashboard`, { credentials: 'include' });
  if (!response.ok) return throwApiError(response, 'Failed to load the dashboard');
  return response.json();
}
