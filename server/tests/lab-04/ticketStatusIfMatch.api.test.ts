import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma';
import { truncateTicketTables } from '../helpers/resetDb';
import { loginAs } from '../helpers/auth';
import { SEED_EMAILS } from '../helpers/staffFixtures';
import { patchStatus } from '../helpers/statusRequest';
import { generateTicketNumber } from '../../src/services/ticketNumber';

// api-spec 4.4: PATCH .../status requires If-Match against Ticket.updatedAt.
describe('PATCH /api/v1/staff/tickets/:id/status If-Match', () => {
  let staffCookie: string;
  let staffId: string;
  let requesterId: string;
  let categoryId: number;

  beforeAll(async () => {
    staffCookie = await loginAs(SEED_EMAILS.itStaff1);
    staffId = (await prisma.user.findUniqueOrThrow({ where: { email: SEED_EMAILS.itStaff1 } })).id;
    requesterId = (await prisma.user.findUniqueOrThrow({ where: { email: SEED_EMAILS.requester } })).id;
    categoryId = (await prisma.category.findFirstOrThrow({ where: { isActive: true } })).id;
  });

  beforeEach(async () => {
    await truncateTicketTables();
  });

  async function createTicket(status: string) {
    const ticketNo = await generateTicketNumber(prisma, new Date().getUTCFullYear());
    return prisma.ticket.create({
      data: {
        ticketNo, summary: 'Monitor flickers', description: 'Screen flickers every few seconds.',
        status: status as never, requestedPriority: 'MEDIUM', itPriority: 'MEDIUM', requesterId, categoryId,
      },
    });
  }

  const etagOf = (t: { updatedAt: Date }) => `"${t.updatedAt.toISOString()}"`;

  it('API-40 a stale If-Match is 409 STALE_UPDATE and a missing one is 428 PRECONDITION_REQUIRED; status unchanged, no event', async () => {
    const ticket = await createTicket('OPEN');
    const staleEtag = etagOf(ticket);
    // Another user changes the Ticket after this screen loaded it.
    await new Promise((resolve) => setTimeout(resolve, 20));
    await prisma.ticket.update({ where: { id: ticket.id }, data: { itPriority: 'HIGH' } });

    const stale = await patchStatus(staffCookie, ticket.id, 'IN_PROGRESS', staleEtag);
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('STALE_UPDATE');

    const missing = await patchStatus(staffCookie, ticket.id, 'IN_PROGRESS', null);
    expect(missing.status).toBe(428);
    expect(missing.body.error.code).toBe('PRECONDITION_REQUIRED');

    const reloaded = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(reloaded.status).toBe('OPEN');
    expect(await prisma.ticketEvent.count({ where: { ticketId: ticket.id } })).toBe(0);
  });

  it('a malformed If-Match is treated as stale (409), not accepted', async () => {
    const ticket = await createTicket('OPEN');
    const response = await patchStatus(staffCookie, ticket.id, 'IN_PROGRESS', 'not-a-date');
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('STALE_UPDATE');
  });

  it('a successful change returns the new etag in the body and the ETag header; the old etag is then stale', async () => {
    const ticket = await createTicket('OPEN');
    const first = await patchStatus(staffCookie, ticket.id, 'IN_PROGRESS', etagOf(ticket));
    expect(first.status).toBe(200);
    expect(first.body.etag).not.toBe(etagOf(ticket));
    expect(first.headers.etag).toBe(first.body.etag);
    const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(first.body.etag).toBe(etagOf(stored));

    const replay = await patchStatus(staffCookie, ticket.id, 'WAITING_FOR_REQUESTER', etagOf(ticket));
    expect(replay.status).toBe(409);
    expect(replay.body.error.code).toBe('STALE_UPDATE');
    const chained = await patchStatus(staffCookie, ticket.id, 'WAITING_FOR_REQUESTER', first.body.etag);
    expect(chained.status).toBe(200);
  });

  it('the staff Ticket detail response carries the etag the status call expects', async () => {
    const ticket = await createTicket('OPEN');
    const detail = await request(app).get(`/api/v1/staff/tickets/${ticket.id}`).set('Cookie', staffCookie);
    expect(detail.status).toBe(200);
    expect(detail.body.etag).toBe(etagOf(ticket));
    const response = await patchStatus(staffCookie, ticket.id, 'IN_PROGRESS', detail.body.etag);
    expect(response.status).toBe(200);
  });

  it('a stale If-Match is reported before the resolution gate runs', async () => {
    const ticket = await createTicket('IN_PROGRESS');
    const staleEtag = etagOf(ticket);
    await new Promise((resolve) => setTimeout(resolve, 20));
    await prisma.ticket.update({ where: { id: ticket.id }, data: { itPriority: 'HIGH' } });
    const response = await patchStatus(staffCookie, ticket.id, 'RESOLVED', staleEtag);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('STALE_UPDATE');
  });

  it('a valid If-Match with zero actions still gets the gate error, and the Ticket stays unchanged', async () => {
    const ticket = await createTicket('IN_PROGRESS');
    const response = await patchStatus(staffCookie, ticket.id, 'RESOLVED', etagOf(ticket));
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('RESOLUTION_REQUIRES_ACTION_TAKEN');
    const reloaded = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(reloaded.status).toBe('IN_PROGRESS');
    expect(reloaded.updatedAt.getTime()).toBe(ticket.updatedAt.getTime());
  });

  it('API-47 two requests sent together with the same If-Match: exactly one 200 and one 409 STALE_UPDATE; the Ticket equals the 200 body', async () => {
    const ticket = await createTicket('OPEN');
    await prisma.actionTaken.create({
      data: { ticketId: ticket.id, performedById: staffId, actionAt: new Date(), description: 'Seed.', result: 'RESOLVED', followUpRequired: false },
    });
    const header = etagOf(ticket);
    const [a, b] = await Promise.all([
      patchStatus(staffCookie, ticket.id, 'IN_PROGRESS', header),
      patchStatus(staffCookie, ticket.id, 'WAITING_FOR_REQUESTER', header),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);
    const winner = a.status === 200 ? a : b;
    const loser = a.status === 200 ? b : a;
    expect(loser.body.error.code).toBe('STALE_UPDATE');
    const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(stored.status).toBe(winner.body.status);
    expect(winner.body.etag).toBe(etagOf(stored));
  });
});
