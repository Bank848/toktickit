import { FieldError } from '../middleware/errorEnvelope';

const ROLES = ['REQUESTER', 'IT_STAFF', 'ADMINISTRATOR'] as const;
type Role = (typeof ROLES)[number];

export interface ValidatedUpdateUserRequest {
  displayName: string;
  email: string;
  role: Role;
  isActive: boolean;
}

type Result = { ok: true; value: ValidatedUpdateUserRequest } | { ok: false; errors: FieldError[] };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// api-spec.md's UpdateUserRequest has no optional fields -- the client's edit form always
// submits every field together (ui-spec.md §9), so a PATCH here is a full replace of these four
// fields, not a sparse patch.
export function validateUpdateUserRequest(body: Record<string, unknown>): Result {
  const errors: FieldError[] = [];

  const rawDisplayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
  if (typeof body.displayName !== 'string' || rawDisplayName.length < 2 || rawDisplayName.length > 100) {
    errors.push({ field: 'displayName', message: 'displayName must be 2-100 characters' });
  }

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

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: { displayName: rawDisplayName, email: rawEmail, role: role as Role, isActive: body.isActive as boolean },
  };
}
