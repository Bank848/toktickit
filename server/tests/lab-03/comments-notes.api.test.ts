import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma';
import { truncateTicketTables } from '../helpers/resetDb';
import { createSessionCookieFor } from '../helpers/session';
import { generateTicketNumber } from '../../src/services/ticketNumber';

describe('Requester Public Comments: GET/POST /api/v1/tickets/:id/comments', () => {
  let requesterId: string;
  let otherRequesterId: string;
  let categoryId: number;

  beforeAll(async () => {
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: 'requester@toktickit.local' } });
    requesterId = requester.id;
    const other = await prisma.user.findUniqueOrThrow({ where: { email: 'requester2@toktickit.local' } });
    otherRequesterId = other.id;
    const category = await prisma.category.findFirstOrThrow({ where: { isActive: true } });
    categoryId = category.id;
  });

  beforeEach(async () => {
    await truncateTicketTables();
  });

  async function createTicket(overrides: { requesterId: string }) {
    const year = new Date().getUTCFullYear();
    const ticketNo = await generateTicketNumber(prisma, year);
    return prisma.ticket.create({
      data: {
        ticketNo,
        summary: 'Summary',
        description: 'Description long enough to pass validation.',
        requestedPriority: 'MEDIUM',
        itPriority: 'MEDIUM',
        requesterId: overrides.requesterId,
        categoryId,
      },
    });
  }

  it('posts a comment with the authenticated author, then appears in the list in order (AC-13)', async () => {
    const ticket = await createTicket({ requesterId });
    const cookie = await createSessionCookieFor(requesterId);

    const postResponse = await request(app)
      .post(`/api/v1/tickets/${ticket.id}/comments`)
      .set('Cookie', cookie)
      .send({ body: 'Any update on this?' });

    expect(postResponse.status).toBe(201);
    expect(postResponse.body.body).toBe('Any update on this?');
    expect(postResponse.body.author.id).toBe(requesterId);
    expect(postResponse.body.ticketId).toBe(ticket.id);

    const listResponse = await request(app)
      .get(`/api/v1/tickets/${ticket.id}/comments`)
      .set('Cookie', cookie);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toHaveLength(1);
    expect(listResponse.body[0].id).toBe(postResponse.body.id);
  });

  it('returns 404 (D-24), never revealing content, when the caller does not own the ticket', async () => {
    const foreignTicket = await createTicket({ requesterId: otherRequesterId });
    const cookie = await createSessionCookieFor(requesterId);

    const getResponse = await request(app)
      .get(`/api/v1/tickets/${foreignTicket.id}/comments`)
      .set('Cookie', cookie);
    const postResponse = await request(app)
      .post(`/api/v1/tickets/${foreignTicket.id}/comments`)
      .set('Cookie', cookie)
      .send({ body: 'Trying to comment on a ticket that is not mine' });
    const missingResponse = await request(app)
      .get(`/api/v1/tickets/${randomUUID()}/comments`)
      .set('Cookie', cookie);

    expect(getResponse.status).toBe(404);
    expect(postResponse.status).toBe(404);
    expect(getResponse.body.error.code).toBe(missingResponse.body.error.code);
    expect(getResponse.body.error.message).toBe(missingResponse.body.error.message);

    const stillNoComments = await prisma.comment.count({ where: { ticketId: foreignTicket.id } });
    expect(stillNoComments).toBe(0);
  });

  it('prepends the fixed server-controlled prefix and never changes ticket status (AC-14, A-08)', async () => {
    const ticket = await createTicket({ requesterId });
    const cookie = await createSessionCookieFor(requesterId);

    const response = await request(app)
      .post(`/api/v1/tickets/${ticket.id}/comments`)
      .set('Cookie', cookie)
      .send({ body: 'The VPN reconnects fine now.', problemAppearsResolved: true });

    expect(response.status).toBe(201);
    expect(response.body.body).toBe(
      '[Requester marked: problem appears resolved] The VPN reconnects fine now.',
    );

    const reloadedTicket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(reloadedTicket.status).toBe(ticket.status); // unchanged, still NEW
  });

  it('stores a client-submitted body that merely starts with the marker text as plain text when the flag is absent', async () => {
    const ticket = await createTicket({ requesterId });
    const cookie = await createSessionCookieFor(requesterId);

    const spoofedBody = '[Requester marked: problem appears resolved] I did not actually check';
    const response = await request(app)
      .post(`/api/v1/tickets/${ticket.id}/comments`)
      .set('Cookie', cookie)
      .send({ body: spoofedBody }); // problemAppearsResolved omitted

    expect(response.status).toBe(201);
    // Stored verbatim -- the flag, not string content, controls the prefix (A-08).
    expect(response.body.body).toBe(spoofedBody);
  });

  it('rejects a body that would exceed the stored VarChar(2000) limit once the prefix is added', async () => {
    const ticket = await createTicket({ requesterId });
    const cookie = await createSessionCookieFor(requesterId);

    const response = await request(app)
      .post(`/api/v1/tickets/${ticket.id}/comments`)
      .set('Cookie', cookie)
      .send({ body: 'x'.repeat(2000), problemAppearsResolved: true });

    expect(response.status).toBe(422);
    expect(response.body.error.fieldErrors[0].field).toBe('body');
  });

  it('rejects an empty or whitespace-only comment with 422, and posts nothing (BR-21)', async () => {
    const ticket = await createTicket({ requesterId });
    const cookie = await createSessionCookieFor(requesterId);

    const response = await request(app)
      .post(`/api/v1/tickets/${ticket.id}/comments`)
      .set('Cookie', cookie)
      .send({ body: '   ' });

    expect(response.status).toBe(422);
    const count = await prisma.comment.count({ where: { ticketId: ticket.id } });
    expect(count).toBe(0);
  });

  it('has no edit or delete route for a comment (append-only, BR-21)', async () => {
    const ticket = await createTicket({ requesterId });
    const cookie = await createSessionCookieFor(requesterId);
    const posted = await request(app)
      .post(`/api/v1/tickets/${ticket.id}/comments`)
      .set('Cookie', cookie)
      .send({ body: 'Original comment' });

    const patchAttempt = await request(app)
      .patch(`/api/v1/tickets/${ticket.id}/comments/${posted.body.id}`)
      .set('Cookie', cookie)
      .send({ body: 'Edited' });
    const deleteAttempt = await request(app)
      .delete(`/api/v1/tickets/${ticket.id}/comments/${posted.body.id}`)
      .set('Cookie', cookie);

    // Express has no matching route for either -- falls through to the default 404 handler,
    // not a 200/204 that would imply an edit/delete capability exists.
    expect(patchAttempt.status).toBe(404);
    expect(deleteAttempt.status).toBe(404);
    const stillOriginal = await prisma.comment.findUniqueOrThrow({ where: { id: posted.body.id } });
    expect(stillOriginal.body).toBe('Original comment');
  });
});
