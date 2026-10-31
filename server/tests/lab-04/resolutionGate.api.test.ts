import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma';
import { truncateTicketTables } from '../helpers/resetDb';
import { loginAs } from '../helpers/auth';
import { SEED_EMAILS } from '../helpers/staffFixtures';
import { generateTicketNumber } from '../../src/services/ticketNumber';

describe('FR-06/BR-09 resolution gate', () => {
  let staffCookie: string;
  let staffId: string;
  let adminCookie: string;
  let requesterId: string;
  let categoryId: number;

  beforeAll(async () => {
    staffCookie = await loginAs(SEED_EMAILS.itStaff1);
    staffId = (await prisma.user.findUniqueOrThrow({ where: { email: SEED_EMAILS.itStaff1 } })).id;
    adminCookie = await loginAs(SEED_EMAILS.admin);
    requesterId = (await prisma.user.findUniqueOrThrow({ where: { email: SEED_EMAILS.requester } })).id;
    categoryId = (await prisma.category.findFirstOrThrow({ where: { isActive: true } })).id;
  });

  beforeEach(async () => {
    await truncateTicketTables();
  });

  async function createTicket(status: string) {
    const ticketNo = await generateTicketNumber(prisma, new Date().getUTCFullYear());
    return prisma.ticket.create({
      data: {
        ticketNo, summary: 'Scanner jams on every print job', description: 'Paper jams on page 2 every time.',
        status: status as never, requestedPriority: 'MEDIUM', itPriority: 'MEDIUM', requesterId, categoryId,
      },
    });
  }

  it('rejects RESOLVED with 409 RESOLUTION_REQUIRES_ACTION_TAKEN when zero Action Taken records exist (AC-04)', async () => {
    const ticket = await createTicket('IN_PROGRESS');
    const response = await request(app)
      .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
      .set('Cookie', staffCookie)
      .send({ status: 'RESOLVED' });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('RESOLUTION_REQUIRES_ACTION_TAKEN');
    const reloaded = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(reloaded.status).toBe('IN_PROGRESS');
  });

  it('accepts RESOLVED from IN_PROGRESS once at least one Action Taken exists (AC-05)', async () => {
    const ticket = await createTicket('IN_PROGRESS');
    await prisma.actionTaken.create({
      data: { ticketId: ticket.id, performedById: staffId, actionAt: new Date(), description: 'Cleared the jam and ran 10 test pages.', result: 'RESOLVED', followUpRequired: false },
    });
    const response = await request(app)
      .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
      .set('Cookie', staffCookie)
      .send({ status: 'RESOLVED' });
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('RESOLVED');
  });

  it('accepts RESOLVED from WAITING_FOR_REQUESTER with a qualifying record (AC-05)', async () => {
    const ticket = await createTicket('WAITING_FOR_REQUESTER');
    await prisma.actionTaken.create({
      data: { ticketId: ticket.id, performedById: staffId, actionAt: new Date(), description: 'Confirmed fix with requester.', result: 'RESOLVED', followUpRequired: false },
    });
    const response = await request(app)
      .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
      .set('Cookie', staffCookie)
      .send({ status: 'RESOLVED' });
    expect(response.status).toBe(200);
  });

  it('accepts RESOLVED even when the only Action Taken has Result=ESCALATED, not RESOLVED (D-02 -- must not filter by Result)', async () => {
    const ticket = await createTicket('IN_PROGRESS');
    await prisma.actionTaken.create({
      data: { ticketId: ticket.id, performedById: staffId, actionAt: new Date(), description: 'Escalated to vendor, vendor confirmed fix over the phone.', result: 'ESCALATED', followUpRequired: false },
    });
    const response = await request(app)
      .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
      .set('Cookie', staffCookie)
      .send({ status: 'RESOLVED' });
    expect(response.status).toBe(200);
  });

  it('an invalid transition to RESOLVED (e.g. from NEW) still returns the pre-existing error, not the gate error', async () => {
    const ticket = await createTicket('NEW');
    const response = await request(app)
      .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
      .set('Cookie', staffCookie)
      .send({ status: 'RESOLVED' });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('a status change that does not target RESOLVED is unaffected by the gate even with zero Action Taken records', async () => {
    const ticket = await createTicket('OPEN');
    const response = await request(app)
      .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
      .set('Cookie', staffCookie)
      .send({ status: 'IN_PROGRESS' });
    expect(response.status).toBe(200);
  });

  it('a Ticket that cycled RESOLVED -> REOPENED -> OPEN -> IN_PROGRESS satisfies the gate on its second RESOLVED pass using the earlier record (specification.md §5)', async () => {
    const ticket = await createTicket('IN_PROGRESS');
    await prisma.actionTaken.create({
      data: { ticketId: ticket.id, performedById: staffId, actionAt: new Date(), description: 'First fix.', result: 'RESOLVED', followUpRequired: false },
    });
    await request(app).patch(`/api/v1/staff/tickets/${ticket.id}/status`).set('Cookie', staffCookie).send({ status: 'RESOLVED' });
    await request(app).patch(`/api/v1/staff/tickets/${ticket.id}/status`).set('Cookie', staffCookie).send({ status: 'REOPENED' });
    await request(app).patch(`/api/v1/staff/tickets/${ticket.id}/status`).set('Cookie', staffCookie).send({ status: 'OPEN' });
    await request(app).patch(`/api/v1/staff/tickets/${ticket.id}/status`).set('Cookie', staffCookie).send({ status: 'IN_PROGRESS' });
    const response = await request(app)
      .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
      .set('Cookie', staffCookie)
      .send({ status: 'RESOLVED' });
    expect(response.status).toBe(200);
  });

  it('FR-01/FR-02: an Administrator can create an Action Taken and use it to satisfy the gate, exactly like IT Staff', async () => {
    const ticket = await createTicket('IN_PROGRESS');
    const created = await request(app)
      .post(`/api/v1/staff/tickets/${ticket.id}/actions`)
      .set('Cookie', adminCookie)
      .set('Idempotency-Key', randomUUID())
      .send({
        actionAt: new Date().toISOString(), description: 'Administrator personally verified the fix.',
        result: 'RESOLVED', followUpRequired: false,
      });
    expect(created.status).toBe(201);
    const response = await request(app)
      .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
      .set('Cookie', adminCookie)
      .send({ status: 'RESOLVED' });
    expect(response.status).toBe(200);
  });

  // The gate count and the status UPDATE run under the Ticket row lock (FOR UPDATE), the same lock
  // actions.ts takes. These two tests hold that lock from a separate transaction, start the status
  // PATCH (which must wait on the lock), change the actions, commit, and check that the PATCH
  // decided on the committed state. A check done outside the lock would read the pre-commit state.
  async function patchWhileLocked(ticketId: string, mutate: (tx: Prisma.TransactionClient) => Promise<void>) {
    let pending!: Promise<request.Response>;
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Ticket" WHERE "id" = ${ticketId} FOR UPDATE`;
      pending = Promise.resolve(
        request(app).patch(`/api/v1/staff/tickets/${ticketId}/status`).set('Cookie', staffCookie).send({ status: 'RESOLVED' }),
      );
      await new Promise((resolve) => setTimeout(resolve, 500));
      await mutate(tx);
    });
    return pending;
  }

  it('an Action Taken committed while the status request waits on the Ticket lock satisfies the gate (same transaction, no race)', async () => {
    const ticket = await createTicket('IN_PROGRESS');
    const response = await patchWhileLocked(ticket.id, async (tx) => {
      await tx.actionTaken.create({
        data: { ticketId: ticket.id, performedById: staffId, actionAt: new Date(), description: 'Added while the status change waited.', result: 'ESCALATED', followUpRequired: false },
      });
    });
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('RESOLVED');
  });

  it('the only Action Taken removed while the status request waits on the Ticket lock makes the gate reject (same transaction, no race)', async () => {
    const ticket = await createTicket('IN_PROGRESS');
    await prisma.actionTaken.create({
      data: { ticketId: ticket.id, performedById: staffId, actionAt: new Date(), description: 'Soon removed.', result: 'RESOLVED', followUpRequired: false },
    });
    const response = await patchWhileLocked(ticket.id, async (tx) => {
      await tx.actionTaken.deleteMany({ where: { ticketId: ticket.id } });
    });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('RESOLUTION_REQUIRES_ACTION_TAKEN');
    const reloaded = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(reloaded.status).toBe('IN_PROGRESS');
  });

  it('a status change committed while the request waits on the Ticket lock is re-validated against the fresh status', async () => {
    const ticket = await createTicket('IN_PROGRESS');
    await prisma.actionTaken.create({
      data: { ticketId: ticket.id, performedById: staffId, actionAt: new Date(), description: 'Has a record.', result: 'RESOLVED', followUpRequired: false },
    });
    const response = await patchWhileLocked(ticket.id, async (tx) => {
      await tx.ticket.update({ where: { id: ticket.id }, data: { status: 'CLOSED' } });
    });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('TICKET_LOCKED');
    const reloaded = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(reloaded.status).toBe('CLOSED');
  });
});
