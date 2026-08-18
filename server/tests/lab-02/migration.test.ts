import { describe, it, expect } from 'vitest';
import { prisma } from '../../src/prisma';

describe('Lab 2 migration', () => {
  it('preserves the four Lab 1 categories with code and isActive backfilled', async () => {
    const categories = await prisma.category.findMany({ orderBy: { id: 'asc' } });

    expect(categories).toHaveLength(4);
    expect(categories.map((c) => c.name)).toEqual([
      'Account and Access',
      'Hardware',
      'Software',
      'Network',
    ]);
    expect(categories.map((c) => c.code)).toEqual(['ACCESS', 'HARDWARE', 'SOFTWARE', 'NETWORK']);
    for (const category of categories) {
      expect(typeof category.isActive).toBe('boolean');
      expect(category.isActive).toBe(true);
    }
  });

  it('creates the TicketCounter table with no rows yet', async () => {
    const count = await prisma.ticketCounter.count();
    expect(count).toBe(0);
  });
});
