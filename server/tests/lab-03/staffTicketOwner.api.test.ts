import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma';
import { truncateTicketTables } from '../helpers/resetDb';
import { loginAs } from '../helpers/auth';
import { SEED_EMAILS } from '../helpers/staffFixtures';
import { generateTicketNumber } from '../../src/services/ticketNumber';

describe('PATCH /api/v1/staff/tickets/:id/owner', () => {
  let staffCookie: string;
  let staff1Id: string;
  let staff2Id: string;
  let inactiveStaffId: string;
  let adminId: string;
  let requesterId: string;
  let categoryId: number;

  beforeAll(async () => {
    staffCookie = await loginAs(SEED_EMAILS.itStaff1);
    staff1Id = (await prisma.user.findUniqueOrThrow({ where: { email: SEED_EMAILS.itStaff1 } })).id;
    staff2Id = (await prisma.user.findUniqueOrThrow({ where: { email: SEED_EMAILS.itStaff2 } })).id;
    inactiveStaffId = (await prisma.user.findUniqueOrThrow({ where: { email: SEED_EMAILS.itStaffInactive } })).id;
    adminId = (await prisma.user.findUniqueOrThrow({ where: { email: SEED_EMAILS.admin } })).id;
    requesterId = (await prisma.user.findUniqueOrThrow({ where: { email: SEED_EMAILS.requester } })).id;
    categoryId = (await prisma.category.findFirstOrThrow({ where: { isActive: true } })).id;
  });

  beforeEach(async () => {
    await truncateTicketTables();
  });

  async function createTicket(overrides: { status?: string; ownerId?: string | null } = {}) {
    const ticketNo = await generateTicketNumber(prisma, new Date().getUTCFullYear());
    return prisma.ticket.create({
      data: {
        ticketNo, summary: 'VPN down', description: 'Cannot connect to VPN from home.',
        requestedPriority: 'HIGH', itPriority: 'HIGH', requesterId, categoryId,
        status: (overrides.status ?? 'NEW') as never, ownerId: overrides.ownerId ?? null,
      },
    });
  }

  it('claiming a NEW unowned ticket sets ownerId and flips status to OPEN in one operation (AC-17)', async () => {
    const ticket = await createTicket();
    const response = await request(app)
      .patch(`/api/v1/staff/tickets/${ticket.id}/owner`)
      .set('Cookie', staffCookie)
      .send({ ownerId: staff1Id });

    expect(response.status).toBe(200);
    expect(response.body.owner.id).toBe(staff1Id);
    expect(response.body.status).toBe('OPEN');
  });

  it('assigning to a different active IT Staff member also works (not just self-claim)', async () => {
    const ticket = await createTicket();
    const response = await request(app)
      .patch(`/api/v1/staff/tickets/${ticket.id}/owner`)
      .set('Cookie', staffCookie)
      .send({ ownerId: staff2Id });
    expect(response.status).toBe(200);
    expect(response.body.owner.id).toBe(staff2Id);
  });

  it('assigning to an active Administrator is allowed (BR-14)', async () => {
    const ticket = await createTicket();
    const response = await request(app)
      .patch(`/api/v1/staff/tickets/${ticket.id}/owner`)
      .set('Cookie', staffCookie)
      .send({ ownerId: adminId });
    expect(response.status).toBe(200);
    expect(response.body.owner.id).toBe(adminId);
  });

  it('reassigning an already-OPEN ticket changes only ownerId, not status', async () => {
    const ticket = await createTicket({ status: 'OPEN', ownerId: staff1Id });
    const response = await request(app)
      .patch(`/api/v1/staff/tickets/${ticket.id}/owner`)
      .set('Cookie', staffCookie)
      .send({ ownerId: staff2Id });
    expect(response.status).toBe(200);
    expect(response.body.owner.id).toBe(staff2Id);
    expect(response.body.status).toBe('OPEN');
  });

  it('rejects assigning to an inactive IT Staff user with 409 INVALID_OWNER', async () => {
    const ticket = await createTicket();
    const response = await request(app)
      .patch(`/api/v1/staff/tickets/${ticket.id}/owner`)
      .set('Cookie', staffCookie)
      .send({ ownerId: inactiveStaffId });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('INVALID_OWNER');
  });

  it('rejects assigning to a Requester with 409 INVALID_OWNER', async () => {
    const ticket = await createTicket();
    const response = await request(app)
      .patch(`/api/v1/staff/tickets/${ticket.id}/owner`)
      .set('Cookie', staffCookie)
      .send({ ownerId: requesterId });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('INVALID_OWNER');
  });

  // AC-18 cross-check: exercises PATCH .../status, implemented in Task 7.
  it('rejects setting status directly to OPEN on a NEW unowned ticket via the status endpoint (AC-18, cross-checked here)', async () => {
    const ticket = await createTicket();
    const response = await request(app)
      .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
      .set('Cookie', staffCookie)
      .send({ status: 'OPEN' });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('rejects reassignment on a CLOSED ticket with 409 TICKET_LOCKED (BR-19)', async () => {
    const ticket = await createTicket({ status: 'CLOSED', ownerId: staff1Id });
    const response = await request(app)
      .patch(`/api/v1/staff/tickets/${ticket.id}/owner`)
      .set('Cookie', staffCookie)
      .send({ ownerId: staff2Id });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('TICKET_LOCKED');
  });

  it('rejects reassignment on a CANCELLED ticket with 409 TICKET_LOCKED (BR-19)', async () => {
    const ticket = await createTicket({ status: 'CANCELLED' });
    const response = await request(app)
      .patch(`/api/v1/staff/tickets/${ticket.id}/owner`)
      .set('Cookie', staffCookie)
      .send({ ownerId: staff1Id });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('TICKET_LOCKED');
  });

  it('rejects a missing ownerId with 422', async () => {
    const ticket = await createTicket();
    const response = await request(app)
      .patch(`/api/v1/staff/tickets/${ticket.id}/owner`)
      .set('Cookie', staffCookie)
      .send({});
    expect(response.status).toBe(422);
  });

  it('returns 404 for a nonexistent ticket id', async () => {
    const response = await request(app)
      .patch('/api/v1/staff/tickets/00000000-0000-0000-0000-000000000000/owner')
      .set('Cookie', staffCookie)
      .send({ ownerId: staff1Id });
    expect(response.status).toBe(404);
  });
});
