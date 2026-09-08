import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma';
import { truncateTicketTables } from '../helpers/resetDb';
import { loginAs } from '../helpers/auth';
import { SEED_EMAILS } from '../helpers/staffFixtures';
import { generateTicketNumber } from '../../src/services/ticketNumber';

describe('GET /api/v1/staff/tickets/:id', () => {
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
        requestedPriority: 'HIGH', itPriority: 'HIGH', requesterId, categoryId,
      },
    });
  }

  it('returns full detail for any ticket, regardless of requester (FR-17)', async () => {
    const ticket = await createTicket();
    const response = await request(app).get(`/api/v1/staff/tickets/${ticket.id}`).set('Cookie', staffCookie);
    expect(response.status).toBe(200);
    expect(response.body.id).toBe(ticket.id);
    expect(response.body.requester).toEqual({ id: requesterId, displayName: expect.any(String) });
    expect(response.body.owner).toBeNull();
  });

  it('returns 404 for a genuinely nonexistent id (no ownership ambiguity for staff)', async () => {
    const response = await request(app)
      .get('/api/v1/staff/tickets/00000000-0000-0000-0000-000000000000')
      .set('Cookie', staffCookie);
    expect(response.status).toBe(404);
  });

  it('rejects a Requester caller with 403, not 404, even for their own ticket', async () => {
    const ticket = await createTicket();
    const response = await request(app).get(`/api/v1/staff/tickets/${ticket.id}`).set('Cookie', requesterCookie);
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN_ROLE');
  });
});
