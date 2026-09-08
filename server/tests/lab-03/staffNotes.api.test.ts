import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma';
import { truncateTicketTables } from '../helpers/resetDb';
import { loginAs } from '../helpers/auth';
import { SEED_EMAILS } from '../helpers/staffFixtures';
import { generateTicketNumber } from '../../src/services/ticketNumber';

describe('Staff Internal Notes', () => {
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
    await prisma.internalNote.deleteMany();
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

  it('IT Staff can write an Internal Note on any ticket (AC-23)', async () => {
    const ticket = await createTicket();
    const response = await request(app)
      .post(`/api/v1/staff/tickets/${ticket.id}/notes`)
      .set('Cookie', staffCookie)
      .send({ body: 'Escalated to network team.' });
    expect(response.status).toBe(201);
    expect(response.body.body).toBe('Escalated to network team.');
  });

  it('lists Internal Notes for a ticket', async () => {
    const ticket = await createTicket();
    const staff = await prisma.user.findUniqueOrThrow({ where: { email: SEED_EMAILS.itStaff1 } });
    await prisma.internalNote.create({ data: { ticketId: ticket.id, authorId: staff.id, body: 'First note' } });
    const response = await request(app).get(`/api/v1/staff/tickets/${ticket.id}/notes`).set('Cookie', staffCookie);
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
  });

  it('rejects empty body with 422', async () => {
    const ticket = await createTicket();
    const response = await request(app)
      .post(`/api/v1/staff/tickets/${ticket.id}/notes`)
      .set('Cookie', staffCookie)
      .send({ body: '' });
    expect(response.status).toBe(422);
  });

  it('a Requester calling the Internal Notes endpoint is rejected 403 with no note content leaked (AC-24, BR-23)', async () => {
    const ticket = await createTicket();
    const staff = await prisma.user.findUniqueOrThrow({ where: { email: SEED_EMAILS.itStaff1 } });
    await prisma.internalNote.create({ data: { ticketId: ticket.id, authorId: staff.id, body: 'Secret internal note' } });

    const response = await request(app).get(`/api/v1/staff/tickets/${ticket.id}/notes`).set('Cookie', requesterCookie);
    expect(response.status).toBe(403);
    expect(JSON.stringify(response.body)).not.toContain('Secret internal note');
  });
});
