const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export type UserRole = 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR';

export interface CurrentUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  mustChangePassword: boolean;
}

export interface FieldError {
  field: string;
  message: string;
}

export class LoginRequestError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

export class ChangePasswordRequestError extends Error {
  code: string;
  fieldErrors: FieldError[];
  constructor(code: string, fieldErrors: FieldError[] = []) {
    super(code);
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

async function readErrorBody(response: Response): Promise<{ code: string; fieldErrors: FieldError[] }> {
  const body = await response.json().catch(() => null);
  return { code: body?.error?.code ?? 'UNKNOWN_ERROR', fieldErrors: body?.error?.fieldErrors ?? [] };
}

export async function login(email: string, password: string): Promise<CurrentUser> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const { code } = await readErrorBody(response);
    throw new LoginRequestError(code);
  }
  return response.json();
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE_URL}/api/v1/auth/logout`, { method: 'POST', credentials: 'include' });
}

export async function fetchMe(): Promise<CurrentUser> {
  const response = await fetch(`${API_BASE_URL}/api/v1/me`, { credentials: 'include' });
  if (!response.ok) throw new Error('Not authenticated');
  return response.json();
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

export async function changePassword(input: ChangePasswordInput): Promise<CurrentUser> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/change-password`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const { code, fieldErrors } = await readErrorBody(response);
    throw new ChangePasswordRequestError(code, fieldErrors);
  }
  return response.json();
}
