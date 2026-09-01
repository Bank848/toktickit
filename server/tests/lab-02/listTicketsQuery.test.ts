import { describe, it, expect } from 'vitest';
import { validateListTicketsQuery } from '../../src/validators/listTicketsQuery';

describe('validateListTicketsQuery', () => {
  it('defaults status/categoryId/q to empty/null, page to 1, pageSize to 10, sort to createdAt:desc', () => {
    const result = validateListTicketsQuery({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      status: [],
      categoryId: null,
      q: null,
      page: 1,
      pageSize: 10,
      sort: 'createdAt:desc',
    });
  });

  it('accepts a single status value as an array', () => {
    const result = validateListTicketsQuery({ status: 'NEW' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toEqual(['NEW']);
  });

  it('accepts multiple status values', () => {
    const result = validateListTicketsQuery({ status: ['NEW', 'RESOLVED'] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toEqual(['NEW', 'RESOLVED']);
  });

  it('parses a valid categoryId', () => {
    const result = validateListTicketsQuery({ categoryId: '3' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.categoryId).toBe(3);
  });

  it('rejects a non-integer categoryId', () => {
    const result = validateListTicketsQuery({ categoryId: 'not-a-number' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual([{ field: 'categoryId', message: 'categoryId must be an integer' }]);
  });

  it('trims q and treats blank/whitespace-only q as omitted', () => {
    const result = validateListTicketsQuery({ q: '   ' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.q).toBeNull();
  });

  it('accepts q up to 100 characters', () => {
    const q = 'a'.repeat(100);
    const result = validateListTicketsQuery({ q });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.q).toBe(q);
  });

  it('rejects q over 100 characters', () => {
    const result = validateListTicketsQuery({ q: 'a'.repeat(101) });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual([{ field: 'q', message: 'q must be 100 characters or fewer' }]);
  });

  it('rejects a page less than 1', () => {
    const result = validateListTicketsQuery({ page: '0' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual([{ field: 'page', message: 'page must be a positive integer' }]);
  });

  it('rejects a non-integer page', () => {
    const result = validateListTicketsQuery({ page: 'abc' });
    expect(result.ok).toBe(false);
  });

  it('clamps pageSize above 50 down to 50 without erroring', () => {
    const result = validateListTicketsQuery({ pageSize: '999' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pageSize).toBe(50);
  });

  it('falls back to 10 for a zero or invalid pageSize', () => {
    const result = validateListTicketsQuery({ pageSize: '0' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pageSize).toBe(10);
  });

  it('accepts every whitelisted sort value', () => {
    for (const sort of ['createdAt:desc', 'createdAt:asc', 'updatedAt:desc', 'ticketNo:asc']) {
      const result = validateListTicketsQuery({ sort });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.sort).toBe(sort);
    }
  });

  it('rejects a sort value outside the whitelist', () => {
    const result = validateListTicketsQuery({ sort: 'summary:asc' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual([
      { field: 'sort', message: 'sort must be one of createdAt:desc, createdAt:asc, updatedAt:desc, ticketNo:asc' },
    ]);
  });

  it('collects multiple field errors at once', () => {
    const result = validateListTicketsQuery({ categoryId: 'x', page: '0', sort: 'bad' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(3);
  });
});
