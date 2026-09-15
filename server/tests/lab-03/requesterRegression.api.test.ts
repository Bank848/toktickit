import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma';
import { truncateTicketTables } from '../helpers/resetDb';
import { createSessionCookieFor } from '../helpers/session';
import { generateTicketNumber } from '../../src/services/ticketNumber';

// FR-12/AC-12: every Lab 2 Requester capability must behave identically once identity comes
// from a real session cookie instead of x-dev-user-id. This file re-runs the load-bearing Lab 2
// assertions (docs/lab-02 equivalents already exist under server/tests/lab-02/*) but
// authenticated the Lab 3 way, so the regression is proven, not assumed.
describe('Requester ticket routes under session-cookie identity (FR-12/AC-12)', () => {
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

  it('creates a ticket owned by the session identity, never a client-supplied id', async () => {
    const cookie = await createSessionCookieFor(requesterId);

    const response = await request(app)
      .post('/api/v1/tickets')
      .set('Cookie', cookie)
      .send({
        summary: 'VPN drops every few minutes',
        description: 'Happens on both wifi and ethernet, started this morning.',
        categoryId,
        relatedSystemId: null,
        requestedPriority: 'HIGH',
      });

    expect(response.status).toBe(201);
    expect(response.body.requester.id).toBe(requesterId);

    const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: response.body.id } });
    expect(stored.requesterId).toBe(requesterId);
  });

  async function createTicketDirect(overrides: { requesterId: string; summary?: string }) {
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
        categoryId,
      },
    });
  }

  it('lists only the session identity\'s own tickets, ignoring a spoofed requesterId query param (AC-03/BR-03)', async () => {
    await createTicketDirect({ requesterId, summary: 'Mine' });
    await createTicketDirect({ requesterId: otherRequesterId, summary: 'Not mine' });
    const cookie = await createSessionCookieFor(requesterId);

    const response = await request(app)
      .get(`/api/v1/tickets?requesterId=${otherRequesterId}`)
      .set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].summary).toBe('Mine');
  });

  it('returns the ticket for its own requester and an identical 404 for foreign/nonexistent ids (D-24)', async () => {
    const own = await createTicketDirect({ requesterId, summary: 'My ticket' });
    const foreign = await createTicketDirect({ requesterId: otherRequesterId, summary: 'Their ticket' });
    const cookie = await createSessionCookieFor(requesterId);

    const ownResponse = await request(app).get(`/api/v1/tickets/${own.id}`).set('Cookie', cookie);
    expect(ownResponse.status).toBe(200);
    expect(ownResponse.body.id).toBe(own.id);

    const foreignResponse = await request(app).get(`/api/v1/tickets/${foreign.id}`).set('Cookie', cookie);
    const missingResponse = await request(app).get(`/api/v1/tickets/${randomUUID()}`).set('Cookie', cookie);

    expect(foreignResponse.status).toBe(404);
    expect(missingResponse.status).toBe(404);
    expect(foreignResponse.body.error.code).toBe(missingResponse.body.error.code);
    expect(foreignResponse.body.error.message).toBe(missingResponse.body.error.message);
  });

  it('returns 401 with no session cookie and 401 with an expired or revoked session (BR-10)', async () => {
    const own = await createTicketDirect({ requesterId });

    const noCookie = await request(app).get(`/api/v1/tickets/${own.id}`);
    expect(noCookie.status).toBe(401);

    const expiredCookie = await createSessionCookieFor(requesterId, { expiresInMs: -1000 });
    const expiredResponse = await request(app).get(`/api/v1/tickets/${own.id}`).set('Cookie', expiredCookie);
    expect(expiredResponse.status).toBe(401);

    const revokedCookie = await createSessionCookieFor(requesterId, { revoked: true });
    const revokedResponse = await request(app).get(`/api/v1/tickets/${own.id}`).set('Cookie', revokedCookie);
    expect(revokedResponse.status).toBe(401);
  });

  it('lists an existing ticket\'s attachments under session-cookie auth, matching Lab 2 behavior (FR-12/AC-12)', async () => {
    const own = await createTicketDirect({ requesterId, summary: 'Has an attachment' });
    await prisma.attachment.create({
      data: {
        ticketId: own.id, uploadedById: requesterId, originalFilename: 'log.txt',
        mimeType: 'text/plain', sizeBytes: 12, storageKey: `test-key-${own.id}`,
      },
    });
    const cookie = await createSessionCookieFor(requesterId);

    const response = await request(app).get(`/api/v1/tickets/${own.id}/attachments`).set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].originalFilename).toBe('log.txt');
  });
});
