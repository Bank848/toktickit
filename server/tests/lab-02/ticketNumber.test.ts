import { describe, it, expect, afterEach } from 'vitest';
import { formatTicketNo, generateTicketNumber } from '../../src/services/ticketNumber';
import { prisma } from '../../src/prisma';

describe('formatTicketNo', () => {
  it('pads single-digit sequence numbers to five digits', () => {
    expect(formatTicketNo(2026, 1)).toBe('TKT-2026-00001');
  });

  it('does not truncate a five-digit sequence number', () => {
    expect(formatTicketNo(2026, 99999)).toBe('TKT-2026-99999');
  });

  it('formats a mid-range sequence number correctly', () => {
    expect(formatTicketNo(2027, 42)).toBe('TKT-2027-00042');
  });
});

describe('generateTicketNumber', () => {
  afterEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE "TicketCounter" RESTART IDENTITY CASCADE');
  });

  it('starts a new year at 1', async () => {
    const result = await prisma.$transaction((tx) => generateTicketNumber(tx, 2099));
    expect(result).toBe('TKT-2099-00001');
  });

  it('increments on the second call for the same year', async () => {
    await prisma.$transaction((tx) => generateTicketNumber(tx, 2099));
    const second = await prisma.$transaction((tx) => generateTicketNumber(tx, 2099));
    expect(second).toBe('TKT-2099-00002');
  });

  it('produces 10 distinct, gapless numbers under concurrent calls', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => prisma.$transaction((tx) => generateTicketNumber(tx, 2098)))
    );
    const sequenceNumbers = results
      .map((ticketNo) => Number(ticketNo.split('-')[2]))
      .sort((a, b) => a - b);
    expect(new Set(sequenceNumbers).size).toBe(10);
    expect(sequenceNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});
