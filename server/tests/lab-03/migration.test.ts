import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/prisma';

describe('Lab 3 migration', () => {
  it('TicketStatus enum has exactly the 8 Lab 3 values and no Lab 2 names remain', async () => {
    const rows = await prisma.$queryRawUnsafe<{ enumlabel: string }[]>(
      `SELECT enumlabel FROM pg_enum e
       JOIN pg_type t ON e.enumtypid = t.oid
       WHERE t.typname = 'TicketStatus'
       ORDER BY e.enumlabel`
    );
    const labels = rows.map((r) => r.enumlabel).sort();
    expect(labels).toEqual(
      [
        'CANCELLED',
        'CLOSED',
        'IN_PROGRESS',
        'NEW',
        'OPEN',
        'REOPENED',
        'RESOLVED',
        'WAITING_FOR_REQUESTER',
      ].sort()
    );
    expect(labels).not.toContain('ASSIGNED');
    expect(labels).not.toContain('PENDING_REQUESTER');
  });

  it('accepts a Ticket write using the new OPEN and WAITING_FOR_REQUESTER status values', async () => {
    const requester = await prisma.user.findUniqueOrThrow({
      where: { email: 'requester@toktickit.local' },
    });
    const category = await prisma.category.findFirstOrThrow();

    const ticket = await prisma.ticket.create({
      data: {
        ticketNo: 'TEST-MIGRATION-0001',
        summary: 'Migration regression check',
        description: 'Created only to exercise the renamed enum values.',
        status: 'OPEN',
        requestedPriority: 'MEDIUM',
        itPriority: 'MEDIUM',
        requesterId: requester.id,
        categoryId: category.id,
      },
    });
    expect(ticket.status).toBe('OPEN');

    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: 'WAITING_FOR_REQUESTER' },
    });
    expect(updated.status).toBe('WAITING_FOR_REQUESTER');

    const reopened = await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: 'REOPENED' },
    });
    expect(reopened.status).toBe('REOPENED');
  });

  it('Session and InternalNote tables exist and accept a row each', async () => {
    const requester = await prisma.user.findUniqueOrThrow({
      where: { email: 'requester@toktickit.local' },
    });
    const staff = await prisma.user.findUniqueOrThrow({
      where: { email: 'itstaff@toktickit.local' },
    });
    const category = await prisma.category.findFirstOrThrow();

    const session = await prisma.session.create({
      data: {
        userId: staff.id,
        tokenHash: 'test-token-hash-0001',
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
      },
    });
    expect(session.revokedAt).toBeNull();

    const ticket = await prisma.ticket.create({
      data: {
        ticketNo: 'TEST-MIGRATION-0002',
        summary: 'Internal note regression check',
        description: 'Created only to exercise the InternalNote table.',
        status: 'NEW',
        requestedPriority: 'LOW',
        itPriority: 'LOW',
        requesterId: requester.id,
        categoryId: category.id,
      },
    });
    const note = await prisma.internalNote.create({
      data: { ticketId: ticket.id, authorId: staff.id, body: 'Internal-only note.' },
    });
    expect(note.body).toBe('Internal-only note.');
  });

  it('User.mustChangePassword defaults to false for a row created without it', async () => {
    const category = await prisma.category.findFirstOrThrow();
    void category; // not needed below, kept for parity with other tests' setup style
    const user = await prisma.user.create({
      data: {
        email: 'migration-default-check@toktickit.local',
        displayName: 'Default Check',
        role: 'REQUESTER',
      },
    });
    expect(user.mustChangePassword).toBe(false);
  });
});
