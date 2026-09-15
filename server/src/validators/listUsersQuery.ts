import { FieldError } from '../middleware/errorEnvelope';

const ROLES = ['REQUESTER', 'IT_STAFF', 'ADMINISTRATOR'] as const;
type Role = (typeof ROLES)[number];

export interface ValidatedListUsersQuery {
  q: string | null;
  role: Role | null;
}

type Result = { ok: true; value: ValidatedListUsersQuery } | { ok: false; errors: FieldError[] };

export function validateListUsersQuery(query: Record<string, unknown>): Result {
  const errors: FieldError[] = [];

  let q: string | null = null;
  if (typeof query.q === 'string') {
    const trimmed = query.q.trim();
    if (trimmed.length > 100) errors.push({ field: 'q', message: 'q must be 100 characters or fewer' });
    else if (trimmed.length > 0) q = trimmed;
  }

  let role: Role | null = null;
  if (query.role !== undefined) {
    if (typeof query.role !== 'string' || !(ROLES as readonly string[]).includes(query.role)) {
      errors.push({ field: 'role', message: `role must be one of ${ROLES.join(', ')}` });
    } else {
      role = query.role as Role;
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { q, role } };
}
