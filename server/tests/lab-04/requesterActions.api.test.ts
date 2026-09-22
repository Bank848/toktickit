import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma';
import { truncateTicketTables } from '../helpers/resetDb';
import { loginAs } from '../helpers/auth';
import { SEED_EMAILS } from '../helpers/staffFixtures';
import { generateTicketNumber } from '../../src/services/ticketNumber';

describe('Requester Action Taken read route', () => {
  let requesterCookie: string;
  let requester2Cookie: string;
  let requesterId: string;
  let staffId: string;
  let categoryId: number;

  beforeAll(async () => {
    requesterCookie = await loginAs(SEED_EMAILS.requester);
    requester2Cookie = await loginAs(SEED_EMAILS.requester2);
    requesterId = (await prisma.user.findUniqueOrThrow({ where: { email: SEED_EMAILS.requester } })).id;
    staffId = (await prisma.user.findUniqueOrThrow({ where: { email: SEED_EMAILS.itStaff1 } })).id;
    categoryId = (await prisma.category.findFirstOrThrow({ where: { isActive: true } })).id;
  });

  beforeEach(async () => {
    await truncateTicketTables();
  });

  async function createOwnedTicket() {
    const ticketNo = await generateTicketNumber(prisma, new Date().getUTCFullYear());
    return prisma.ticket.create({
      data: {
        ticketNo, summary: 'Keyboard not responding', description: 'Half the keys stopped working.',
        requestedPriority: 'LOW', itPriority: 'LOW', requesterId, categoryId,
      },
    });
  }

  it('a Requester sees every field of every Action Taken on their own ticket (FR-03/BR-11/AC-09)', async () => {
    const ticket = await createOwnedTicket();
    await prisma.actionTaken.create({
      data: {
        ticketId: ticket.id, performedById: staffId, actionAt: new Date(),
        description: 'Replaced the keyboard.', result: 'RESOLVED', followUpRequired: false,
        attachmentNotes: 'Photo shared via email.',
      },
    });
    const response = await request(app).get(`/api/v1/tickets/${ticket.id}/actions`).set('Cookie', requesterCookie);
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].description).toBe('Replaced the keyboard.');
    expect(response.body[0].attachmentNotes).toBe('Photo shared via email.');
    expect(response.body[0].performedBy.displayName).toBeDefined();
  });

  it('returns 404 TICKET_NOT_ACCESSIBLE for a ticket the caller does not own, without leaking existence (D-24 precedent)', async () => {
    const ticket = await createOwnedTicket();
    const response = await request(app).get(`/api/v1/tickets/${ticket.id}/actions`).set('Cookie', requester2Cookie);
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('TICKET_NOT_ACCESSIBLE');
  });

  it('there is no write route for a Requester to be rejected from (POST 404s, not 403 or 405)', async () => {
    const ticket = await createOwnedTicket();
    const response = await request(app)
      .post(`/api/v1/tickets/${ticket.id}/actions`)
      .set('Cookie', requesterCookie)
      .send({});
    expect(response.status).toBe(404);
  });

  it('there is no edit route for a Requester either -- PATCH also 404s, never 403/405 (AC-09)', async () => {
    const ticket = await createOwnedTicket();
    const response = await request(app)
      .patch(`/api/v1/tickets/${ticket.id}/actions/00000000-0000-0000-0000-000000000000`)
      .set('Cookie', requesterCookie)
      .send({});
    expect(response.status).toBe(404);
  });
});
