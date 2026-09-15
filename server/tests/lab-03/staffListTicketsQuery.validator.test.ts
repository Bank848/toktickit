import { describe, it, expect } from 'vitest';
import { validateStaffListTicketsQuery } from '../../src/validators/staffListTicketsQuery';

describe('validateStaffListTicketsQuery', () => {
  it('defaults to no filters, page 1, pageSize 10, sort createdAt:desc', () => {
    const result = validateStaffListTicketsQuery({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        status: [], itPriority: null, ownerId: null, q: null, page: 1, pageSize: 10,
        sort: 'createdAt:desc',
      });
    }
  });

  it('accepts a valid itPriority', () => {
    const result = validateStaffListTicketsQuery({ itPriority: 'HIGH' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.itPriority).toBe('HIGH');
  });

  it('rejects an invalid itPriority with 422-shaped field error', () => {
    const result = validateStaffListTicketsQuery({ itPriority: 'SUPER_URGENT' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual([
        { field: 'itPriority', message: 'itPriority must be one of LOW, MEDIUM, HIGH, URGENT' },
      ]);
    }
  });

  it('accepts ownerId=unassigned literally', () => {
    const result = validateStaffListTicketsQuery({ ownerId: 'unassigned' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.ownerId).toBe('unassigned');
  });

  it('rejects an empty-string ownerId (never silently ignored, api-spec.md #16)', () => {
    const result = validateStaffListTicketsQuery({ ownerId: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual([{ field: 'ownerId', message: 'ownerId must not be empty' }]);
    }
  });

  it('accepts a non-empty ownerId as an opaque id (existence checked later by the route)', () => {
    const result = validateStaffListTicketsQuery({ ownerId: 'some-uuid' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.ownerId).toBe('some-uuid');
  });

  it('reuses the same status/q/page/pageSize/sort rules as My Tickets', () => {
    const result = validateStaffListTicketsQuery({ status: ['NEW', 'OPEN'], q: '  vpn  ', pageSize: 999 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toEqual(['NEW', 'OPEN']);
      expect(result.value.q).toBe('vpn');
      expect(result.value.pageSize).toBe(50); // clamps, does not 422 (api-spec.md #7 convention)
    }
  });

  it('rejects an invalid sort value', () => {
    const result = validateStaffListTicketsQuery({ sort: 'summary:asc' });
    expect(result.ok).toBe(false);
  });
});
