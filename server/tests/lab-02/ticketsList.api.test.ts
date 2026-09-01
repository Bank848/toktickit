import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma';
import { truncateTicketTables } from '../helpers/resetDb';
import { generateTicketNumber } from '../../src/services/ticketNumber';

describe('GET /api/v1/tickets', () => {
  let requesterId: string;
  let otherRequesterId: string;
  let categoryId: number;
  let otherCategoryId: number;

  beforeAll(async () => {
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: 'requester@toktickit.local' } });
    requesterId = requester.id;
    const other = await prisma.user.findUniqueOrThrow({ where: { email: 'requester2@toktickit.local' } });
    otherRequesterId = other.id;

    const categories = await prisma.category.findMany({ where: { isActive: true }, take: 2 });
    categoryId = categories[0].id;
    otherCategoryId = categories[1]?.id ?? categories[0].id;
  });

  beforeEach(async () => {
    await truncateTicketTables();
  });

  async function createTicket(overrides: {
    requesterId: string;
    summary?: string;
    status?: 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'PENDING_REQUESTER' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';
    categoryId?: number;
  }) {
    const year = new Date().getUTCFullYear();
    const ticketNo = await generateTicketNumber(prisma, year);
    return prisma.ticket.create({
      data: {
        ticketNo,
        summary: overrides.summary ?? 'Default summary',
        description: 'Some description text long enough.',
        requestedPriority: 'MEDIUM',
        itPriority: 'MEDIUM',
        requesterId: overrides.requesterId,
        categoryId: overrides.categoryId ?? categoryId,
        status: overrides.status ?? 'NEW',
      },
    });
  }

  it('returns only the caller\'s own tickets regardless of what other tickets are seeded', async () => {
    await createTicket({ requesterId, summary: 'Mine' });
    await createTicket({ requesterId: otherRequesterId, summary: 'Not mine' });

    const response = await request(app).get('/api/v1/tickets').set('x-dev-user-id', requesterId);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].summary).toBe('Mine');
  });

  it('matches q against ticketNo or summary case-insensitively', async () => {
    const ticket = await createTicket({ requesterId, summary: 'VPN keeps DROPPING' });
    await createTicket({ requesterId, summary: 'Printer jam' });

    const response = await request(app)
      .get('/api/v1/tickets')
      .query({ q: 'vpn' })
      .set('x-dev-user-id', requesterId);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].id).toBe(ticket.id);

    const byTicketNo = await request(app)
      .get('/api/v1/tickets')
      .query({ q: ticket.ticketNo.toLowerCase() })
      .set('x-dev-user-id', requesterId);
    expect(byTicketNo.body.data).toHaveLength(1);
    expect(byTicketNo.body.data[0].id).toBe(ticket.id);
  });

  it('combines status/categoryId/q with AND semantics', async () => {
    await createTicket({ requesterId, summary: 'VPN issue', status: 'NEW', categoryId });
    await createTicket({ requesterId, summary: 'VPN issue resolved', status: 'RESOLVED', categoryId });
    await createTicket({ requesterId, summary: 'VPN issue other category', status: 'NEW', categoryId: otherCategoryId });

    const response = await request(app)
      .get('/api/v1/tickets')
      .query({ q: 'VPN', status: 'NEW', categoryId })
      .set('x-dev-user-id', requesterId);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].summary).toBe('VPN issue');
  });

  it('returns 422 for an invalid sort value', async () => {
    const response = await request(app)
      .get('/api/v1/tickets')
      .query({ sort: 'summary:asc' })
      .set('x-dev-user-id', requesterId);

    expect(response.status).toBe(422);
    expect(response.body.error.fieldErrors).toEqual([
      { field: 'sort', message: 'sort must be one of createdAt:desc, createdAt:asc, updatedAt:desc, ticketNo:asc' },
    ]);
  });

  it('clamps pageSize=999 down to 50 silently (200, not 422)', async () => {
    const response = await request(app)
      .get('/api/v1/tickets')
      .query({ pageSize: 999 })
      .set('x-dev-user-id', requesterId);

    expect(response.status).toBe(200);
    expect(response.body.meta.pageSize).toBe(50);
  });

  it('distinguishes zero-tickets-ever from zero-matches-for-filters via an accurate meta.total', async () => {
    const zeroEver = await request(app).get('/api/v1/tickets').set('x-dev-user-id', requesterId);
    expect(zeroEver.status).toBe(200);
    expect(zeroEver.body.data).toHaveLength(0);
    expect(zeroEver.body.meta.total).toBe(0);

    await createTicket({ requesterId, summary: 'Printer jam' });
    const zeroMatches = await request(app)
      .get('/api/v1/tickets')
      .query({ q: 'nonexistent-search-term' })
      .set('x-dev-user-id', requesterId);
    expect(zeroMatches.status).toBe(200);
    expect(zeroMatches.body.data).toHaveLength(0);
    expect(zeroMatches.body.meta.total).toBe(0);
  });

  it('returns 401 without identity', async () => {
    const response = await request(app).get('/api/v1/tickets');
    expect(response.status).toBe(401);
  });

  it('never lets a query-supplied requesterId override the authenticated caller', async () => {
    await createTicket({ requesterId, summary: 'Mine' });
    await createTicket({ requesterId: otherRequesterId, summary: 'Theirs' });

    const response = await request(app)
      .get('/api/v1/tickets')
      .query({ requesterId: otherRequesterId })
      .set('x-dev-user-id', requesterId);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].summary).toBe('Mine');
  });
});

describe('POST /api/v1/tickets response shape', () => {
  it('does not include a commentCount field', async () => {
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: 'requester@toktickit.local' } });
    const category = await prisma.category.findFirstOrThrow({ where: { isActive: true } });
    await truncateTicketTables();

    const response = await request(app)
      .post('/api/v1/tickets')
      .set('x-dev-user-id', requester.id)
      .send({
        summary: 'Test ticket for DTO shape',
        description: 'Checking that commentCount is not present in the response body.',
        categoryId: category.id,
        requestedPriority: 'MEDIUM',
      });

    expect(response.status).toBe(201);
    expect(response.body).not.toHaveProperty('commentCount');
  });
});
