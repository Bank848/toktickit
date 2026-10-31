import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma';
import { truncateTicketTables } from '../helpers/resetDb';
import { loginAs } from '../helpers/auth';
import { SEED_EMAILS } from '../helpers/staffFixtures';
import { generateTicketNumber } from '../../src/services/ticketNumber';

describe('GET /api/v1/dashboard (Requester Dashboard)', () => {
  let requesterCookie: string;
  let requester2Cookie: string;
  let staffCookie: string;
  let adminCookie: string;
  let requesterId: string;
  let requester2Id: string;
  let categoryId: number;

  beforeAll(async () => {
    requesterCookie = await loginAs(SEED_EMAILS.requester);
    requester2Cookie = await loginAs(SEED_EMAILS.requester2);
    staffCookie = await loginAs(SEED_EMAILS.itStaff1);
    adminCookie = await loginAs(SEED_EMAILS.admin);
    requesterId = (await prisma.user.findUniqueOrThrow({ where: { email: SEED_EMAILS.requester } })).id;
    requester2Id = (await prisma.user.findUniqueOrThrow({ where: { email: SEED_EMAILS.requester2 } })).id;
    categoryId = (await prisma.category.findFirstOrThrow({ where: { isActive: true } })).id;
  });

  beforeEach(async () => {
    await truncateTicketTables();
  });

  async function createTicket(status: string, owner = requesterId) {
    const ticketNo = await generateTicketNumber(prisma, new Date().getUTCFullYear());
    return prisma.ticket.create({
      data: {
        ticketNo, summary: 'Dashboard fixture ticket', description: 'desc',
        status: status as never, requestedPriority: 'MEDIUM', itPriority: 'MEDIUM',
        requesterId: owner, categoryId,
      },
    });
  }

  it('API-26: a new Requester gets every count 0 and an empty recentTickets array', async () => {
    const response = await request(app).get('/api/v1/dashboard').set('Cookie', requester2Cookie);
    expect(response.status).toBe(200);
    expect(Object.keys(response.body.statusCounts)).toHaveLength(8);
    expect(Object.values(response.body.statusCounts).every((n) => n === 0)).toBe(true);
    expect(response.body.recentTickets).toEqual([]);
  });

  it('API-27: mixed data counts and lists only the caller own Tickets', async () => {
    await createTicket('OPEN');
    await createTicket('OPEN');
    await createTicket('RESOLVED');
    await createTicket('OPEN', requester2Id);
    const response = await request(app).get('/api/v1/dashboard').set('Cookie', requesterCookie);
    expect(response.status).toBe(200);
    expect(response.body.statusCounts.OPEN).toBe(2);
    expect(response.body.statusCounts.RESOLVED).toBe(1);
    expect(response.body.recentTickets).toHaveLength(3);
  });

  it('API-28: IT Staff and Administrator get 403 on the Requester dashboard', async () => {
    expect((await request(app).get('/api/v1/dashboard').set('Cookie', staffCookie)).status).toBe(403);
    expect((await request(app).get('/api/v1/dashboard').set('Cookie', adminCookie)).status).toBe(403);
    expect((await request(app).get('/api/v1/dashboard')).status).toBe(401);
  });

  it('API-32: ?requesterId= and ?userId= overrides are ignored (BR-12)', async () => {
    await createTicket('OPEN', requesterId);
    const response = await request(app)
      .get(`/api/v1/dashboard?requesterId=${requesterId}&userId=${requesterId}`)
      .set('Cookie', requester2Cookie);
    expect(response.status).toBe(200);
    expect(response.body.statusCounts.OPEN).toBe(0);
    expect(response.body.recentTickets).toEqual([]);
  });

  it('recentTickets is stable by id descending when updatedAt ties', async () => {
    const a = await createTicket('OPEN');
    const b = await createTicket('OPEN');
    await prisma.$executeRaw`UPDATE "Ticket" SET "updatedAt" = ${new Date('2026-01-01T00:00:00.000Z')}`;
    const first = await request(app).get('/api/v1/dashboard').set('Cookie', requesterCookie);
    const second = await request(app).get('/api/v1/dashboard').set('Cookie', requesterCookie);
    const expected = [a.id, b.id].sort().reverse();
    expect(first.body.recentTickets.map((t: { id: string }) => t.id)).toEqual(expected);
    expect(second.body.recentTickets.map((t: { id: string }) => t.id)).toEqual(expected);
  });

  describe('FR-10 drill-down: card count equals the list total behind the link', () => {
    const STATUSES = ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED'];

    it('GET /tickets?status=<STATUS> returns meta.total equal to the dashboard count for every status', async () => {
      // A different count per status, so a filter that ignores the status cannot pass by luck.
      for (const [index, status] of STATUSES.entries()) {
        for (let i = 0; i <= index; i += 1) {
          // eslint-disable-next-line no-await-in-loop
          await createTicket(status);
        }
      }
      await createTicket('OPEN', requester2Id);

      const dashboard = await request(app).get('/api/v1/dashboard').set('Cookie', requesterCookie);
      for (const [index, status] of STATUSES.entries()) {
        // eslint-disable-next-line no-await-in-loop
        const list = await request(app).get(`/api/v1/tickets?status=${status}`).set('Cookie', requesterCookie);
        expect(list.status).toBe(200);
        expect(dashboard.body.statusCounts[status]).toBe(index + 1);
        expect(list.body.meta.total).toBe(dashboard.body.statusCounts[status]);
        expect(list.body.data.every((t: { status: string }) => t.status === status)).toBe(true);
      }
    });

    it('an unknown status is rejected with 422 VALIDATION_FAILED', async () => {
      const response = await request(app).get('/api/v1/tickets?status=BOGUS').set('Cookie', requesterCookie);
      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
      expect(response.body.error.fieldErrors[0].field).toBe('status');
    });

    it('a repeated status parameter is an OR of the listed statuses', async () => {
      await createTicket('OPEN');
      await createTicket('RESOLVED');
      await createTicket('CLOSED');
      const response = await request(app).get('/api/v1/tickets?status=OPEN&status=RESOLVED').set('Cookie', requesterCookie);
      expect(response.status).toBe(200);
      expect(response.body.meta.total).toBe(2);
    });
  });
});
