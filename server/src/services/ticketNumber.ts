import { Prisma } from '@prisma/client';

export function formatTicketNo(year: number, sequence: number): string {
  return `TKT-${year}-${String(sequence).padStart(5, '0')}`;
}

/**
 * Atomically allocates the next ticket number for `year` inside the caller's transaction.
 * Never uses count(*) + 1 -- that races under concurrent inserts. `upsert` compiles to a single
 * native `INSERT ... ON CONFLICT (year) DO UPDATE ... RETURNING` on Postgres, so there is no
 * error-branching, catch-and-retry logic to get wrong: a genuine unique-constraint race between
 * two callers creating the same year's row for the first time is resolved server-side by the
 * ON CONFLICT clause itself, inside the same statement, with no partial-transaction recovery
 * needed. (An earlier draft of this function used update() -> catch P2025 -> create() -> catch
 * P2002 -> retry update() -- that's unsound: a real P2002 from create() leaves the surrounding
 * Postgres transaction aborted, so the retried update() inside the catch block would itself
 * throw "current transaction is aborted" instead of succeeding. upsert() avoids that failure
 * mode structurally.)
 */
export async function generateTicketNumber(
  tx: Prisma.TransactionClient,
  year: number
): Promise<string> {
  const counter = await tx.ticketCounter.upsert({
    where: { year },
    update: { lastValue: { increment: 1 } },
    create: { year, lastValue: 1 },
  });

  return formatTicketNo(year, counter.lastValue);
}
