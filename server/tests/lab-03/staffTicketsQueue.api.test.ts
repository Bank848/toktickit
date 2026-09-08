import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma';
import { truncateTicketTables } from '../helpers/resetDb';
import { loginAs } from '../helpers/auth';
import { SEED_EMAILS } from '../helpers/staffFixtures';
import { generateTicketNumber } from '../../src/services/ticketNumber';

describe('GET /api/v1/staff/tickets', () => {
  let staffCookie: string;
  let requesterCookie: string;
  let requesterId: string;
  let requester2Id: string;
  let categoryId: number;

  beforeAll(async () => {
    staffCookie = await loginAs(SEED_EMAILS.itStaff1);
    requesterCookie = await loginAs(SEED_EMAILS.requester);
    requesterId = (await prisma.user.findUniqueOrThrow({ where: { email: SEED_EMAILS.requester } })).id;
    requester2Id = (await prisma.user.findUniqueOrThrow({ where: { email: SEED_EMAILS.requester2 } })).id;
    categoryId = (await prisma.category.findFirstOrThrow({ where: { isActive: true } })).id;
  });

  beforeEach(async () => {
    await truncateTicketTables();
  });

  async function createTicket(overrides: { requesterId: string; summary?: string; status?: string }) {
    const ticketNo = await generateTicketNumber(prisma, new Date().getUTCFullYear());
    return prisma.ticket.create({
      data: {
        ticketNo,
        summary: overrides.summary ?? 'Default summary',
        description: 'Some description text long enough.',
        requestedPriority: 'MEDIUM', itPriority: 'MEDIUM',
        requesterId: overrides.requesterId, categoryId,
        status: (overrides.status ?? 'NEW') as never,
      },
    });
  }

  it('rejects a Requester caller with 403 FORBIDDEN_ROLE', async () => {
    const response = await request(app).get('/api/v1/staff/tickets').set('Cookie', requesterCookie);
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN_ROLE');
  });

  it('rejects an unauthenticated caller with 401', async () => {
    const response = await request(app).get('/api/v1/staff/tickets');
    expect(response.status).toBe(401);
  });

  it('lists tickets from every requester, not only one (AC-15)', async () => {
    await createTicket({ requesterId, summary: 'Mine' });
    await createTicket({ requesterId: requester2Id, summary: 'Theirs' });

    const response = await request(app).get('/api/v1/staff/tickets').set('Cookie', staffCookie);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    const summaries = response.body.data.map((t: { summary: string }) => t.summary).sort();
    expect(summaries).toEqual(['Mine', 'Theirs']);
  });

  it('includes owner (null when unassigned) on each item, unlike TicketListItemDto', async () => {
    await createTicket({ requesterId, summary: 'Unassigned one' });
    const response = await request(app).get('/api/v1/staff/tickets').set('Cookie', staffCookie);
    expect(response.body.data[0].owner).toBeNull();
  });

  it('combines search, status filter, and itPriority filter with AND semantics (AC-16)', async () => {
    const a = await createTicket({ requesterId, summary: 'VPN drops', status: 'NEW' });
    await prisma.ticket.update({ where: { id: a.id }, data: { itPriority: 'HIGH' } });
    await createTicket({ requesterId, summary: 'VPN drops but resolved', status: 'RESOLVED' });
    await createTicket({ requesterId, summary: 'Printer jam', status: 'NEW' });

    const response = await request(app)
      .get('/api/v1/staff/tickets')
      .query({ q: 'VPN', status: 'NEW', itPriority: 'HIGH' })
      .set('Cookie', staffCookie);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].id).toBe(a.id);
  });

  it('ownerId=unassigned filters to tickets with no owner', async () => {
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: SEED_EMAILS.itStaff1 } });
    const assigned = await createTicket({ requesterId, summary: 'Has owner', status: 'OPEN' });
    await prisma.ticket.update({ where: { id: assigned.id }, data: { ownerId: owner.id } });
    await createTicket({ requesterId, summary: 'No owner' });

    const response = await request(app)
      .get('/api/v1/staff/tickets')
      .query({ ownerId: 'unassigned' })
      .set('Cookie', staffCookie);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].summary).toBe('No owner');
  });

  it('rejects a malformed ownerId with 422 instead of silently returning empty results', async () => {
    const response = await request(app)
      .get('/api/v1/staff/tickets')
      .query({ ownerId: 'not-a-real-user-id' })
      .set('Cookie', staffCookie);
    // The route resolves ownerId against real users; an id that matches no one is a validation
    // error (api-spec.md #16 "never silently ignored"), not an empty result set.
    expect(response.status).toBe(422);
    expect(response.body.error.fieldErrors).toEqual([
      { field: 'ownerId', message: 'ownerId must be a real user id or "unassigned"' },
    ]);
  });
});
