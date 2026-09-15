import { FieldError } from '../middleware/errorEnvelope';
import { validatePasswordPolicy } from '../auth/passwordPolicy';

const ROLES = ['REQUESTER', 'IT_STAFF', 'ADMINISTRATOR'] as const;
type Role = (typeof ROLES)[number];

export interface ValidatedCreateUserRequest {
  displayName: string;
  email: string;
  role: Role;
  isActive: boolean;
  initialPassword: string;
}

type Result = { ok: true; value: ValidatedCreateUserRequest } | { ok: false; errors: FieldError[] };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCreateUserRequest(body: Record<string, unknown>): Result {
  const errors: FieldError[] = [];

  const rawDisplayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
  if (typeof body.displayName !== 'string' || rawDisplayName.length < 2 || rawDisplayName.length > 100) {
    errors.push({ field: 'displayName', message: 'displayName must be 2-100 characters' });
  }

  // A-05: normalize to lowercase before uniqueness check and insert.
  const rawEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (typeof body.email !== 'string' || !EMAIL_RE.test(rawEmail)) {
    errors.push({ field: 'email', message: 'email must be a valid email address' });
  }

  const role = body.role;
  if (typeof role !== 'string' || !(ROLES as readonly string[]).includes(role)) {
    errors.push({ field: 'role', message: `role must be one of ${ROLES.join(', ')}` });
  }

  if (typeof body.isActive !== 'boolean') {
    errors.push({ field: 'isActive', message: 'isActive is required and must be a boolean' });
  }

  // #36's validatePasswordPolicy (server/src/auth/passwordPolicy.ts) requires password to
  // already be a string -- it has no built-in "is required" check for non-string input --
  // so that case is handled here before delegating the actual policy rules to it.
  if (typeof body.initialPassword !== 'string') {
    errors.push({ field: 'initialPassword', message: 'initialPassword is required' });
  } else {
    errors.push(...validatePasswordPolicy(body.initialPassword, 'initialPassword'));
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      displayName: rawDisplayName,
      email: rawEmail,
      role: role as Role,
      isActive: body.isActive as boolean,
      initialPassword: body.initialPassword as string,
    },
  };
}
