import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma';
import { truncateTicketTables } from '../helpers/resetDb';
import { generateTicketNumber } from '../../src/services/ticketNumber';

describe('GET /api/v1/tickets/:id', () => {
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

  async function createTicket(overrides: { requesterId: string; summary?: string }) {
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

  it('returns 200 with the full TicketDetailDto for the caller\'s own ticket', async () => {
    const ticket = await createTicket({ requesterId, summary: 'My VPN is broken' });

    const response = await request(app)
      .get(`/api/v1/tickets/${ticket.id}`)
      .set('x-dev-user-id', requesterId);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: ticket.id,
      ticketNo: ticket.ticketNo,
      summary: 'My VPN is broken',
      description: ticket.description,
      status: 'NEW',
      requestedPriority: 'MEDIUM',
      itPriority: 'MEDIUM',
      attachmentCount: 0,
      requester: { id: requesterId },
      owner: null,
      resolutionSummary: null,
      version: ticket.version,
    });
    expect(response.body.category.id).toBe(categoryId);
  });

  it('returns 401 without identity', async () => {
    const ticket = await createTicket({ requesterId });
    const response = await request(app).get(`/api/v1/tickets/${ticket.id}`);
    expect(response.status).toBe(401);
  });

  it('returns 404 for a ticket belonging to a different requester, and a byte-identical body for a nonexistent id (D-24)', async () => {
    const ticket = await createTicket({ requesterId: otherRequesterId });

    const foreignResponse = await request(app)
      .get(`/api/v1/tickets/${ticket.id}`)
      .set('x-dev-user-id', requesterId);
    const missingResponse = await request(app)
      .get(`/api/v1/tickets/${randomUUID()}`)
      .set('x-dev-user-id', requesterId);

    expect(foreignResponse.status).toBe(404);
    expect(missingResponse.status).toBe(404);
    // Byte-identical aside from the per-request correlationId (D-24) -- a 403 here would have
    // confirmed the ticket's existence, so both cases must produce the same code/message/shape.
    expect(foreignResponse.body.error.code).toBe(missingResponse.body.error.code);
    expect(foreignResponse.body.error.message).toBe(missingResponse.body.error.message);
    expect(foreignResponse.body.error.fieldErrors).toEqual(missingResponse.body.error.fieldErrors);
  });
});
