import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma';
import { truncateTicketTables } from '../helpers/resetDb';
import { loginAs } from '../helpers/auth';
import { SEED_EMAILS } from '../helpers/staffFixtures';

// PERF-01 (specification section 10): 2,000 Tickets and 5,000 Action Taken records, 30 calls to each
// of GET /dashboard, GET /staff/dashboard and the staff actions list. The 95th percentile must stay
// under 500 ms on the dev machine, and the number of Prisma operations behind one dashboard call
// must not depend on how many Tickets exist (no per-Ticket query).
const TICKETS = 2000;
const ACTIONS = 5000;
const CALLS = 30;
const P95_LIMIT_MS = 500;
const STATUSES = ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED'] as const;
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
const RESULTS = ['RESOLVED', 'ESCALATED', 'NO_ACTION_NEEDED', 'PENDING_FOLLOW_UP'] as const;

function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * 0.95) - 1];
}

describe('PERF-01 dashboard and actions list performance smoke', () => {
  let requesterCookie: string;
  let staffCookie: string;
  let requesterId: string;
  let staffId: string;
  let categoryId: number;
  let busyTicketId = '';
  let operations = 0;

  async function timeCalls(path: string, cookie: string): Promise<number[]> {
    const samples: number[] = [];
    for (let i = 0; i < CALLS; i += 1) {
      const started = performance.now();
      const response = await request(app).get(path).set('Cookie', cookie);
      samples.push(performance.now() - started);
      expect(response.status, path).toBe(200);
    }
    return samples;
  }

  async function operationsFor(path: string, cookie: string): Promise<number> {
    operations = 0;
    const response = await request(app).get(path).set('Cookie', cookie);
    expect(response.status, path).toBe(200);
    return operations;
  }

  beforeAll(async () => {
    requesterCookie = await loginAs(SEED_EMAILS.requester);
    staffCookie = await loginAs(SEED_EMAILS.itStaff1);
    requesterId = (await prisma.user.findUniqueOrThrow({ where: { email: SEED_EMAILS.requester } })).id;
    staffId = (await prisma.user.findUniqueOrThrow({ where: { email: SEED_EMAILS.itStaff1 } })).id;
    categoryId = (await prisma.category.findFirstOrThrow({ where: { isActive: true } })).id;
    await truncateTicketTables();
    // Counts Prisma operations (not SQL statements) behind each request. `$use` is deprecated in
    // Prisma 5 but still supported, and is enough to show the count does not grow with the data.
    prisma.$use(async (params, next) => {
      operations += 1;
      return next(params);
    });
  }, 120_000);

  afterAll(async () => {
    await truncateTicketTables();
  }, 120_000);

  it('keeps the Prisma operation count per call constant when the data grows, and the 95th percentile under 500 ms', async () => {
    const paths = {
      requester: '/api/v1/dashboard',
      staff: '/api/v1/staff/dashboard',
    };

    // A small data set first: one Ticket.
    await prisma.ticket.create({
      data: {
        ticketNo: 'TKT-2099-00000', summary: 'Perf fixture', description: 'd', status: 'OPEN',
        requestedPriority: 'MEDIUM', itPriority: 'MEDIUM', requesterId, categoryId, ownerId: staffId,
      },
    });
    const smallRequester = await operationsFor(paths.requester, requesterCookie);
    const smallStaff = await operationsFor(paths.staff, staffCookie);
    await truncateTicketTables();

    // The full data set. Half the Tickets belong to the signed-in Requester, a third are owned by
    // the signed-in staff user, and one Ticket carries 500 of the Action Taken records.
    const ticketRows = Array.from({ length: TICKETS }, (_, i) => ({
      ticketNo: `TKT-2099-${String(i + 1).padStart(5, '0')}`,
      summary: `Perf fixture ${i}`, description: 'd',
      status: STATUSES[i % STATUSES.length],
      requestedPriority: PRIORITIES[i % PRIORITIES.length], itPriority: PRIORITIES[(i + 1) % PRIORITIES.length],
      requesterId, categoryId,
      ownerId: i % 3 === 0 ? staffId : null,
      createdAt: new Date(Date.UTC(2026, 0, 1) + i * 60_000), updatedAt: new Date(Date.UTC(2026, 0, 1) + i * 60_000),
    }));
    await prisma.ticket.createMany({ data: ticketRows });
    const tickets = await prisma.ticket.findMany({ select: { id: true }, orderBy: { ticketNo: 'asc' } });
    busyTicketId = tickets[0].id;
    const actionRows = Array.from({ length: ACTIONS }, (_, i) => ({
      ticketId: i < 500 ? busyTicketId : tickets[1 + (i % (TICKETS - 1))].id,
      performedById: staffId,
      actionAt: new Date(Date.UTC(2026, 1, 1) + i * 1000),
      description: `Perf action ${i}`, result: RESULTS[i % RESULTS.length], followUpRequired: false,
    }));
    await prisma.actionTaken.createMany({ data: actionRows });
    expect(await prisma.ticket.count()).toBe(TICKETS);
    expect(await prisma.actionTaken.count()).toBe(ACTIONS);

    const largeRequester = await operationsFor(paths.requester, requesterCookie);
    const largeStaff = await operationsFor(paths.staff, staffCookie);
    expect(largeRequester, 'Requester dashboard operations at 2,000 Tickets').toBe(smallRequester);
    expect(largeStaff, 'IT Staff dashboard operations at 2,000 Tickets').toBe(smallStaff);

    const requesterP95 = p95(await timeCalls(paths.requester, requesterCookie));
    const staffP95 = p95(await timeCalls(paths.staff, staffCookie));
    const actionsP95 = p95(await timeCalls(`/api/v1/staff/tickets/${busyTicketId}/actions`, staffCookie));
    console.log(
      `PERF-01 p95 ms: requester dashboard ${requesterP95.toFixed(1)}, staff dashboard ${staffP95.toFixed(1)}, ` +
        `actions list (500 rows) ${actionsP95.toFixed(1)}; Prisma operations per call: requester ${largeRequester}, staff ${largeStaff}`,
    );
    expect(requesterP95, 'GET /dashboard p95').toBeLessThan(P95_LIMIT_MS);
    expect(staffP95, 'GET /staff/dashboard p95').toBeLessThan(P95_LIMIT_MS);
    expect(actionsP95, 'staff actions list p95').toBeLessThan(P95_LIMIT_MS);
  }, 300_000);
});
