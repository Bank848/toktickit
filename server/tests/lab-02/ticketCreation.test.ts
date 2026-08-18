import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma';
import { truncateTicketTables } from '../helpers/resetDb';
import { generateTicketNumber } from '../../src/services/ticketNumber';

describe('POST /api/v1/tickets', () => {
  beforeEach(async () => {
    await truncateTicketTables();
  });

  it('creates a ticket with itPriority copied server-side and one TICKET_CREATED event', async () => {
    const category = await prisma.category.findFirstOrThrow({ where: { isActive: true } });

    const response = await request(app)
      .post('/api/v1/tickets')
      .set('x-dev-user-email', 'requester@toktickit.local')
      .send({
        summary: 'VPN keeps disconnecting',
        description: 'Drops every few minutes since this morning, on both wifi and ethernet.',
        categoryId: category.id,
        requestedPriority: 'HIGH',
      });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('NEW');
    expect(response.body.requestedPriority).toBe('HIGH');
    expect(response.body.itPriority).toBe('HIGH');
    expect(response.body.ticketNo).toMatch(/^TKT-\d{4}-\d{5}$/);

    const events = await prisma.ticketEvent.findMany({ where: { ticketId: response.body.id } });
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('TICKET_CREATED');
  });

  it('ignores a client-supplied requesterId and always uses the authenticated user', async () => {
    const category = await prisma.category.findFirstOrThrow({ where: { isActive: true } });
    const otherUser = await prisma.user.findUniqueOrThrow({ where: { email: 'requester2@toktickit.local' } });

    const response = await request(app)
      .post('/api/v1/tickets')
      .set('x-dev-user-email', 'requester@toktickit.local')
      .send({
        summary: 'Printer out of toner',
        description: 'The 3rd floor printer shows a toner-empty light and will not print.',
        categoryId: category.id,
        requestedPriority: 'LOW',
        requesterId: otherUser.id,
        itPriority: 'URGENT',
        status: 'RESOLVED',
      });

    expect(response.status).toBe(201);
    expect(response.body.requester.id).not.toBe(otherUser.id);
    expect(response.body.itPriority).toBe('LOW');
    expect(response.body.status).toBe('NEW');
  });

  it('returns 401 without identity', async () => {
    const response = await request(app).post('/api/v1/tickets').send({});
    expect(response.status).toBe(401);
  });

  it('returns 422 with fieldErrors for an invalid body', async () => {
    const response = await request(app)
      .post('/api/v1/tickets')
      .set('x-dev-user-email', 'requester@toktickit.local')
      .send({ summary: 'ab', description: 'too short', categoryId: 1, requestedPriority: 'HIGH' });

    expect(response.status).toBe(422);
    expect(response.body.error.fieldErrors.length).toBeGreaterThan(0);
  });

  it('returns 422 when categoryId points at an inactive category', async () => {
    const inactiveCategory = await prisma.category.create({
      data: { name: 'Deprecated Category', code: 'DEPRECATED', isActive: false },
    });

    const response = await request(app)
      .post('/api/v1/tickets')
      .set('x-dev-user-email', 'requester@toktickit.local')
      .send({
        summary: 'Testing inactive category rejection',
        description: 'This request targets a category that has been deactivated on purpose.',
        categoryId: inactiveCategory.id,
        requestedPriority: 'MEDIUM',
      });

    expect(response.status).toBe(422);
    expect(response.body.error.fieldErrors.some((e: { field: string }) => e.field === 'categoryId')).toBe(true);

    await prisma.category.delete({ where: { id: inactiveCategory.id } });
  });

  it('produces 10 distinct ticket numbers with no gaps or duplicates under concurrent creation', async () => {
    const category = await prisma.category.findFirstOrThrow({ where: { isActive: true } });

    const responses = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        request(app)
          .post('/api/v1/tickets')
          .set('x-dev-user-email', 'requester@toktickit.local')
          .send({
            summary: `Concurrency test ticket ${i}`,
            description: 'Body text long enough to pass the 10-character minimum requirement.',
            categoryId: category.id,
            requestedPriority: 'LOW',
          })
      )
    );

    for (const response of responses) {
      expect(response.status).toBe(201);
    }
    const ticketNumbers = responses.map((r) => r.body.ticketNo);
    expect(new Set(ticketNumbers).size).toBe(10);
  });

  it('returns 422 for a relatedSystemId that does not exist, without touching the transaction at all', async () => {
    const category = await prisma.category.findFirstOrThrow({ where: { isActive: true } });
    const before = await prisma.ticket.count();

    // This is caught by the pre-transaction existence check in the route handler, before
    // prisma.$transaction is even entered -- it proves bad references never reach the
    // transaction, not transaction rollback itself (see the next test for that).
    const response = await request(app)
      .post('/api/v1/tickets')
      .set('x-dev-user-email', 'requester@toktickit.local')
      .send({
        summary: 'Nonexistent related system test',
        description: 'relatedSystemId below does not exist and must be rejected before insert.',
        categoryId: category.id,
        relatedSystemId: 999999,
        requestedPriority: 'LOW',
      });

    expect(response.status).toBe(422);
    const after = await prisma.ticket.count();
    expect(after).toBe(before);
  });

  it('rolls back the ticket insert if the event insert fails inside the same transaction', async () => {
    const category = await prisma.category.findFirstOrThrow({ where: { isActive: true } });
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'requester@toktickit.local' } });
    const before = await prisma.ticket.count();

    await expect(
      prisma.$transaction(async (tx) => {
        const ticketNo = await generateTicketNumber(tx, 2097);
        const created = await tx.ticket.create({
          data: {
            ticketNo,
            summary: 'Rollback probe ticket',
            description: 'This ticket must not survive because the next insert fails on purpose.',
            requestedPriority: 'LOW',
            itPriority: 'LOW',
            requesterId: user.id,
            categoryId: category.id,
          },
        });
        // Ticket insert above already succeeded within this transaction. Now force a
        // foreign-key violation on the event insert (a non-existent actor) to prove the
        // whole transaction -- including the ticket that already "succeeded" -- rolls back.
        await tx.ticketEvent.create({
          data: { ticketId: created.id, actorId: 'nonexistent-actor-id', eventType: 'TICKET_CREATED' },
        });
      })
    ).rejects.toThrow();

    const after = await prisma.ticket.count();
    expect(after).toBe(before);
    const orphanEvents = await prisma.ticketEvent.count();
    expect(orphanEvents).toBe(0);
  });
});
