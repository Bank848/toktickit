import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma';
import { truncateTicketTables } from '../helpers/resetDb';
import { loginAs } from '../helpers/auth';
import { SEED_EMAILS } from '../helpers/staffFixtures';
import { generateTicketNumber } from '../../src/services/ticketNumber';

describe('Staff Public Comments', () => {
  let staffCookie: string;
  let requesterCookie: string;
  let requesterId: string;
  let categoryId: number;

  beforeAll(async () => {
    staffCookie = await loginAs(SEED_EMAILS.itStaff1);
    requesterCookie = await loginAs(SEED_EMAILS.requester);
    requesterId = (await prisma.user.findUniqueOrThrow({ where: { email: SEED_EMAILS.requester } })).id;
    categoryId = (await prisma.category.findFirstOrThrow({ where: { isActive: true } })).id;
  });

  beforeEach(async () => {
    await truncateTicketTables();
  });

  async function createTicket() {
    const ticketNo = await generateTicketNumber(prisma, new Date().getUTCFullYear());
    return prisma.ticket.create({
      data: {
        ticketNo, summary: 'VPN down', description: 'Cannot connect to VPN from home.',
        requestedPriority: 'MEDIUM', itPriority: 'MEDIUM', requesterId, categoryId,
      },
    });
  }

  it('IT Staff can post a Public Comment on any ticket, not only ones they requested (AC-23)', async () => {
    const ticket = await createTicket();
    const response = await request(app)
      .post(`/api/v1/staff/tickets/${ticket.id}/comments`)
      .set('Cookie', staffCookie)
      .send({ body: 'We are looking into this.' });
    expect(response.status).toBe(201);
    expect(response.body.body).toBe('We are looking into this.');
    expect(response.body.author.id).toBeDefined();
  });

  it('lists Public Comments for any ticket', async () => {
    const ticket = await createTicket();
    await prisma.comment.create({ data: { ticketId: ticket.id, authorId: requesterId, body: 'Existing comment' } });
    const response = await request(app).get(`/api/v1/staff/tickets/${ticket.id}/comments`).set('Cookie', staffCookie);
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
  });

  it('rejects problemAppearsResolved in the body with 422 (Requester-only flag, api-spec.md #22)', async () => {
    const ticket = await createTicket();
    const response = await request(app)
      .post(`/api/v1/staff/tickets/${ticket.id}/comments`)
      .set('Cookie', staffCookie)
      .send({ body: 'Fixed it.', problemAppearsResolved: true });
    expect(response.status).toBe(422);
  });

  it('rejects empty/whitespace-only body with 422', async () => {
    const ticket = await createTicket();
    const response = await request(app)
      .post(`/api/v1/staff/tickets/${ticket.id}/comments`)
      .set('Cookie', staffCookie)
      .send({ body: '   ' });
    expect(response.status).toBe(422);
  });

  it('returns 403 for a Requester caller even on their own ticket (this is the Staff namespace)', async () => {
    const ticket = await createTicket();
    const response = await request(app)
      .get(`/api/v1/staff/tickets/${ticket.id}/comments`)
      .set('Cookie', requesterCookie);
    expect(response.status).toBe(403);
  });
});
