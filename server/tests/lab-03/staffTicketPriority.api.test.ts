import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma';
import { truncateTicketTables } from '../helpers/resetDb';
import { loginAs } from '../helpers/auth';
import { SEED_EMAILS } from '../helpers/staffFixtures';
import { generateTicketNumber } from '../../src/services/ticketNumber';

describe('PATCH /api/v1/staff/tickets/:id/priority', () => {
  let staffCookie: string;
  let requesterId: string;
  let categoryId: number;

  beforeAll(async () => {
    staffCookie = await loginAs(SEED_EMAILS.itStaff1);
    requesterId = (await prisma.user.findUniqueOrThrow({ where: { email: SEED_EMAILS.requester } })).id;
    categoryId = (await prisma.category.findFirstOrThrow({ where: { isActive: true } })).id;
  });

  beforeEach(async () => {
    await truncateTicketTables();
  });

  async function createTicket(overrides: { status?: string; itPriority?: string } = {}) {
    const ticketNo = await generateTicketNumber(prisma, new Date().getUTCFullYear());
    return prisma.ticket.create({
      data: {
        ticketNo, summary: 'VPN down', description: 'Cannot connect to VPN from home.',
        requestedPriority: 'MEDIUM', itPriority: (overrides.itPriority ?? 'MEDIUM') as never,
        requesterId, categoryId, status: (overrides.status ?? 'NEW') as never,
      },
    });
  }

  it('sets IT Priority independently of Requested Priority (AC-22)', async () => {
    const ticket = await createTicket();
    const response = await request(app)
      .patch(`/api/v1/staff/tickets/${ticket.id}/priority`)
      .set('Cookie', staffCookie)
      .send({ itPriority: 'URGENT' });
    expect(response.status).toBe(200);
    expect(response.body.itPriority).toBe('URGENT');
    expect(response.body.requestedPriority).toBe('MEDIUM');
  });

  it('rejects a priority change on a CLOSED ticket with 409 TICKET_LOCKED (AC-20)', async () => {
    const ticket = await createTicket({ status: 'CLOSED' });
    const response = await request(app)
      .patch(`/api/v1/staff/tickets/${ticket.id}/priority`)
      .set('Cookie', staffCookie)
      .send({ itPriority: 'HIGH' });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('TICKET_LOCKED');
  });

  it('rejects a priority change on a CANCELLED ticket with 409 TICKET_LOCKED (AC-20)', async () => {
    const ticket = await createTicket({ status: 'CANCELLED' });
    const response = await request(app)
      .patch(`/api/v1/staff/tickets/${ticket.id}/priority`)
      .set('Cookie', staffCookie)
      .send({ itPriority: 'HIGH' });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('TICKET_LOCKED');
  });

  it('rejects an invalid itPriority value with 422', async () => {
    const ticket = await createTicket();
    const response = await request(app)
      .patch(`/api/v1/staff/tickets/${ticket.id}/priority`)
      .set('Cookie', staffCookie)
      .send({ itPriority: 'SUPER_URGENT' });
    expect(response.status).toBe(422);
  });
});
