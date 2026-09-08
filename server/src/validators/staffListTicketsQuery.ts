import { FieldError } from '../middleware/errorEnvelope';

const SORT_WHITELIST = ['createdAt:desc', 'createdAt:asc', 'updatedAt:desc', 'ticketNo:asc'] as const;
const PRIORITY_WHITELIST = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
type Sort = typeof SORT_WHITELIST[number];
type Priority = typeof PRIORITY_WHITELIST[number];

export interface ValidatedStaffListTicketsQuery {
  status: string[];
  itPriority: Priority | null;
  ownerId: string | null;
  q: string | null;
  page: number;
  pageSize: number;
  sort: Sort;
}

type Result = { ok: true; value: ValidatedStaffListTicketsQuery } | { ok: false; errors: FieldError[] };

export function validateStaffListTicketsQuery(query: Record<string, unknown>): Result {
  const errors: FieldError[] = [];

  const status = Array.isArray(query.status) ? query.status.map(String) : query.status ? [String(query.status)] : [];

  let itPriority: Priority | null = null;
  if (query.itPriority !== undefined) {
    if ((PRIORITY_WHITELIST as readonly string[]).includes(String(query.itPriority))) {
      itPriority = query.itPriority as Priority;
    } else {
      errors.push({ field: 'itPriority', message: 'itPriority must be one of ' + PRIORITY_WHITELIST.join(', ') });
    }
  }

  let ownerId: string | null = null;
  if (query.ownerId !== undefined) {
    const raw = String(query.ownerId);
    if (raw.length === 0) errors.push({ field: 'ownerId', message: 'ownerId must not be empty' });
    else ownerId = raw;
  }

  let q: string | null = null;
  if (typeof query.q === 'string') {
    const trimmed = query.q.trim();
    if (trimmed.length > 100) errors.push({ field: 'q', message: 'q must be 100 characters or fewer' });
    else if (trimmed.length > 0) q = trimmed;
  }

  const page = query.page !== undefined ? Number(query.page) : 1;
  if (!Number.isInteger(page) || page < 1) errors.push({ field: 'page', message: 'page must be a positive integer' });

  const rawPageSize = query.pageSize !== undefined ? Number(query.pageSize) : 10;
  const pageSize = Number.isInteger(rawPageSize) && rawPageSize > 0 ? Math.min(rawPageSize, 50) : 10;

  const sort = typeof query.sort === 'string' && (SORT_WHITELIST as readonly string[]).includes(query.sort)
    ? (query.sort as Sort)
    : query.sort !== undefined
      ? null
      : 'createdAt:desc';
  if (sort === null) errors.push({ field: 'sort', message: 'sort must be one of ' + SORT_WHITELIST.join(', ') });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { status, itPriority, ownerId, q, page, pageSize, sort: sort as Sort } };
}
