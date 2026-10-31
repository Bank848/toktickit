import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma';
import { truncateTicketTables } from '../helpers/resetDb';
import { loginAs } from '../helpers/auth';
import { SEED_EMAILS } from '../helpers/staffFixtures';
import { generateTicketNumber } from '../../src/services/ticketNumber';

const ROLES = ['REQUESTER', 'IT_STAFF', 'ADMINISTRATOR'] as const;

describe('GET /api/v1/staff/dashboard (IT Staff and Administrator Dashboard)', () => {
  let requesterCookie: string;
  let staffCookie: string;
  let adminCookie: string;
  let requesterId: string;
  let staffId: string;
  let categoryId: number;
  const extraUserIds: string[] = [];

  beforeAll(async () => {
    requesterCookie = await loginAs(SEED_EMAILS.requester);
    staffCookie = await loginAs(SEED_EMAILS.itStaff1);
    adminCookie = await loginAs(SEED_EMAILS.admin);
    requesterId = (await prisma.user.findUniqueOrThrow({ where: { email: SEED_EMAILS.requester } })).id;
    staffId = (await prisma.user.findUniqueOrThrow({ where: { email: SEED_EMAILS.itStaff1 } })).id;
    categoryId = (await prisma.category.findFirstOrThrow({ where: { isActive: true } })).id;
  });

  beforeEach(async () => {
    await truncateTicketTables();
  });

  afterEach(async () => {
    if (extraUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: extraUserIds.splice(0) } } });
    }
  });

  async function createTicket(status: string, ownerId: string | null = null) {
    const ticketNo = await generateTicketNumber(prisma, new Date().getUTCFullYear());
    return prisma.ticket.create({
      data: {
        ticketNo, summary: 'Dashboard fixture ticket', description: 'desc',
        status: status as never, requestedPriority: 'MEDIUM', itPriority: 'MEDIUM',
        requesterId, categoryId, ownerId,
      },
    });
  }

  it('API-28: a Requester gets 403 on the staff dashboard', async () => {
    expect((await request(app).get('/api/v1/staff/dashboard').set('Cookie', requesterCookie)).status).toBe(403);
    expect((await request(app).get('/api/v1/staff/dashboard')).status).toBe(401);
  });

  it('allows IT Staff and Administrator on the staff dashboard and on another staff route (gate widened)', async () => {
    expect((await request(app).get('/api/v1/staff/dashboard').set('Cookie', staffCookie)).status).toBe(200);
    expect((await request(app).get('/api/v1/staff/dashboard').set('Cookie', adminCookie)).status).toBe(200);
    expect((await request(app).get('/api/v1/staff/tickets').set('Cookie', adminCookie)).status).toBe(200);
    expect((await request(app).get('/api/v1/staff/tickets').set('Cookie', requesterCookie)).status).toBe(403);
  });

  it('API-29: unassignedCount matches a direct count of ownerId null with a non-terminal status', async () => {
    await createTicket('NEW');
    await createTicket('OPEN');
    await createTicket('CLOSED');
    await createTicket('CANCELLED');
    await createTicket('OPEN', staffId);
    const direct = await prisma.ticket.count({ where: { ownerId: null, status: { notIn: ['CLOSED', 'CANCELLED'] } } });
    const response = await request(app).get('/api/v1/staff/dashboard').set('Cookie', staffCookie);
    expect(response.status).toBe(200);
    expect(response.body.unassignedCount).toBe(direct);
    expect(response.body.unassignedCount).toBe(2);
  });

  it('FR-08 vs AC-10: ownedByMeCount counts every status while unassignedCount skips CLOSED and CANCELLED', async () => {
    await createTicket('IN_PROGRESS', staffId);
    await createTicket('CLOSED', staffId);
    await createTicket('CANCELLED', staffId);
    await createTicket('CLOSED');
    await createTicket('NEW');
    const response = await request(app).get('/api/v1/staff/dashboard').set('Cookie', staffCookie);
    expect(response.body.ownedByMeCount).toBe(3);
    expect(response.body.unassignedCount).toBe(1);
  });

  it('statusCounts and priorityCounts span all Requesters and are zero-filled', async () => {
    await createTicket('OPEN');
    const response = await request(app).get('/api/v1/staff/dashboard').set('Cookie', staffCookie);
    expect(Object.keys(response.body.statusCounts)).toHaveLength(8);
    expect(Object.keys(response.body.priorityCounts).sort()).toEqual(['HIGH', 'LOW', 'MEDIUM', 'URGENT']);
    expect(response.body.statusCounts.OPEN).toBe(1);
    expect(response.body.priorityCounts.MEDIUM).toBe(1);
    expect(response.body.priorityCounts.URGENT).toBe(0);
  });

  it('API-30: an IT Staff caller gets no userCounts key at all', async () => {
    const response = await request(app).get('/api/v1/staff/dashboard').set('Cookie', staffCookie);
    expect(Object.prototype.hasOwnProperty.call(response.body, 'userCounts')).toBe(false);
  });

  it('API-31: an Administrator gets userCounts for 3 roles counting only active accounts', async () => {
    for (const role of ROLES) {
      // eslint-disable-next-line no-await-in-loop
      const user = await prisma.user.create({
        data: { email: `inactive-${role.toLowerCase()}@dashboard.test`, displayName: 'Inactive', role, isActive: false },
      });
      extraUserIds.push(user.id);
    }
    const expected: Record<string, number> = {};
    for (const role of ROLES) {
      // eslint-disable-next-line no-await-in-loop
      expected[role] = await prisma.user.count({ where: { role, isActive: true } });
    }
    const response = await request(app).get('/api/v1/staff/dashboard').set('Cookie', adminCookie);
    expect(response.status).toBe(200);
    expect(response.body.userCounts).toEqual(expected);
  });

  it('API-32: ?userId= and ?ownerId= overrides are ignored (BR-12)', async () => {
    await createTicket('IN_PROGRESS', staffId);
    const response = await request(app)
      .get(`/api/v1/staff/dashboard?userId=${staffId}&ownerId=${staffId}`)
      .set('Cookie', adminCookie);
    expect(response.status).toBe(200);
    expect(response.body.ownedByMeCount).toBe(0); // the admin owns nothing; the staff ticket is not counted
  });

  it('recentTickets holds at most 5 entries, ties on updatedAt break on id descending', async () => {
    for (let i = 0; i < 7; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await createTicket('OPEN');
    }
    await prisma.$executeRaw`UPDATE "Ticket" SET "updatedAt" = ${new Date('2026-01-01T00:00:00.000Z')}`;
    const response = await request(app).get('/api/v1/staff/dashboard').set('Cookie', staffCookie);
    const ids: string[] = response.body.recentTickets.map((t: { id: string }) => t.id);
    expect(ids).toHaveLength(5);
    expect(ids).toEqual([...ids].sort().reverse());
  });

  it('an Administrator may perform an IT Staff write action (specification section 7)', async () => {
    const ticket = await createTicket('OPEN');
    const response = await request(app)
      .patch(`/api/v1/staff/tickets/${ticket.id}/priority`)
      .set('Cookie', adminCookie)
      .send({ itPriority: 'HIGH' });
    expect(response.status).toBe(200);
  });

  it('FR-10 drill-down: staff list filtered by status or by owner matches the card counts, unknown status is 422', async () => {
    await createTicket('OPEN', staffId);
    await createTicket('OPEN');
    await createTicket('IN_PROGRESS', staffId);
    const dashboard = await request(app).get('/api/v1/staff/dashboard').set('Cookie', staffCookie);
    const open = await request(app).get('/api/v1/staff/tickets?status=OPEN').set('Cookie', staffCookie);
    expect(open.body.meta.total).toBe(dashboard.body.statusCounts.OPEN);
    const mine = await request(app).get(`/api/v1/staff/tickets?ownerId=${staffId}`).set('Cookie', staffCookie);
    expect(mine.body.meta.total).toBe(dashboard.body.ownedByMeCount);
    const bogus = await request(app).get('/api/v1/staff/tickets?status=BOGUS').set('Cookie', staffCookie);
    expect(bogus.status).toBe(422);
    expect(bogus.body.error.code).toBe('VALIDATION_FAILED');
  });
});
