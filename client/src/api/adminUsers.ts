const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export interface FieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  status: number;
  fieldErrors: FieldError[];
  code?: string;
  constructor(message: string, status: number, fieldErrors: FieldError[] = [], code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.code = code;
  }
}

export type UserRole = 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR';

export interface UserAdminDto {
  id: string;
  displayName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
}

async function throwApiError(response: Response): Promise<never> {
  const body = await response.json().catch(() => null);
  const error = body?.error;
  throw new ApiError(error?.message ?? 'Request failed', response.status, error?.fieldErrors ?? [], error?.code);
}

export async function fetchUsers(params: { q?: string; role?: UserRole | '' }): Promise<UserAdminDto[]> {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (params.role) query.set('role', params.role);
  const response = await fetch(`${API_BASE_URL}/api/v1/admin/users?${query.toString()}`, {
    credentials: 'include',
  });
  if (!response.ok) return throwApiError(response);
  return response.json();
}

export interface CreateUserPayload {
  displayName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  initialPassword: string;
}

export async function createUser(payload: CreateUserPayload): Promise<UserAdminDto> {
  const response = await fetch(`${API_BASE_URL}/api/v1/admin/users`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) return throwApiError(response);
  return response.json();
}

export interface UpdateUserPayload {
  displayName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

export async function updateUser(id: string, payload: UpdateUserPayload): Promise<UserAdminDto> {
  const response = await fetch(`${API_BASE_URL}/api/v1/admin/users/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) return throwApiError(response);
  return response.json();
}

export async function setInitialPassword(id: string, newInitialPassword: string): Promise<UserAdminDto> {
  const response = await fetch(`${API_BASE_URL}/api/v1/admin/users/${id}/password`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newInitialPassword }),
  });
  if (!response.ok) return throwApiError(response);
  return response.json();
}
