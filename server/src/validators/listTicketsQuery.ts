import { FieldError } from '../middleware/errorEnvelope';

const SORT_WHITELIST = ['createdAt:desc', 'createdAt:asc', 'updatedAt:desc', 'ticketNo:asc'] as const;
type Sort = typeof SORT_WHITELIST[number];

export interface ValidatedListTicketsQuery {
  status: string[];
  categoryId: number | null;
  q: string | null;
  page: number;
  pageSize: number;
  sort: Sort;
}

type Result = { ok: true; value: ValidatedListTicketsQuery } | { ok: false; errors: FieldError[] };

export function validateListTicketsQuery(query: Record<string, unknown>): Result {
  const errors: FieldError[] = [];

  const status = Array.isArray(query.status) ? query.status.map(String) : query.status ? [String(query.status)] : [];

  let categoryId: number | null = null;
  if (query.categoryId !== undefined) {
    const parsed = Number(query.categoryId);
    if (!Number.isInteger(parsed)) errors.push({ field: 'categoryId', message: 'categoryId must be an integer' });
    else categoryId = parsed;
  }

  let q: string | null = null;
  if (typeof query.q === 'string') {
    const trimmed = query.q.trim();
    if (trimmed.length > 100) errors.push({ field: 'q', message: 'q must be 100 characters or fewer' });
    else if (trimmed.length > 0) q = trimmed; // blank/whitespace-only q behaves as omitted
  }

  const page = query.page !== undefined ? Number(query.page) : 1;
  if (!Number.isInteger(page) || page < 1) errors.push({ field: 'page', message: 'page must be a positive integer' });

  // pageSize clamps silently rather than erroring, per api-spec.md #7.
  const rawPageSize = query.pageSize !== undefined ? Number(query.pageSize) : 10;
  const pageSize = Number.isInteger(rawPageSize) && rawPageSize > 0 ? Math.min(rawPageSize, 50) : 10;

  const sort = typeof query.sort === 'string' && (SORT_WHITELIST as readonly string[]).includes(query.sort)
    ? (query.sort as Sort)
    : query.sort !== undefined
      ? null
      : 'createdAt:desc';
  if (sort === null) errors.push({ field: 'sort', message: 'sort must be one of ' + SORT_WHITELIST.join(', ') });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { status, categoryId, q, page, pageSize, sort: sort as Sort } };
}
