import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { prisma } from '../../src/prisma';
import { truncateTicketTables } from '../helpers/resetDb';
import { generateTicketNumber } from '../../src/services/ticketNumber';

describe('ActionTaken model (Lab 4 schema)', () => {
  let requesterId: string;
  let staffId: string;
  let staff2Id: string;
  let categoryId: number;

  beforeAll(async () => {
    const requester = await prisma.user.findFirstOrThrow({ where: { role: 'REQUESTER' } });
    const staff = await prisma.user.findFirstOrThrow({ where: { role: 'IT_STAFF' }, orderBy: { email: 'asc' } });
    const staff2 = await prisma.user.findFirstOrThrow({
      where: { role: 'IT_STAFF', email: { not: staff.email } },
      orderBy: { email: 'asc' },
    });
    requesterId = requester.id;
    staffId = staff.id;
    staff2Id = staff2.id;
    categoryId = (await prisma.category.findFirstOrThrow({ where: { isActive: true } })).id;
  });

  beforeEach(async () => {
    await truncateTicketTables();
  });

  async function createTicket() {
    const ticketNo = await generateTicketNumber(prisma, new Date().getUTCFullYear());
    return prisma.ticket.create({
      data: {
        ticketNo, summary: 'Printer offline', description: 'Front-desk printer shows offline.',
        requestedPriority: 'MEDIUM', itPriority: 'MEDIUM', requesterId, categoryId,
      },
    });
  }

  it('creates an ActionTaken with performedById set and lastEditedById null', async () => {
    const ticket = await createTicket();
    const action = await prisma.actionTaken.create({
      data: {
        ticketId: ticket.id, performedById: staffId, actionAt: new Date(),
        description: 'Power-cycled the printer and reseated the network cable.',
        result: 'RESOLVED', followUpRequired: false,
      },
    });
    expect(action.performedById).toBe(staffId);
    expect(action.lastEditedById).toBeNull();
    expect(action.result).toBe('RESOLVED');
  });

  it('allows lastEditedById to differ from performedById on edit', async () => {
    const ticket = await createTicket();
    const created = await prisma.actionTaken.create({
      data: {
        ticketId: ticket.id, performedById: staffId, actionAt: new Date(),
        description: 'Initial diagnosis.', result: 'PENDING_FOLLOW_UP',
        followUpRequired: true, followUpNote: 'Waiting on replacement toner cartridge.',
      },
    });
    const edited = await prisma.actionTaken.update({
      where: { id: created.id },
      data: { lastEditedById: staff2Id, description: 'Cartridge replaced, confirmed printing.' },
    });
    expect(edited.performedById).toBe(staffId);
    expect(edited.lastEditedById).toBe(staff2Id);
  });

  it('does not touch Ticket.updatedAt when an ActionTaken is created (D-06/BR-14)', async () => {
    const ticket = await createTicket();
    await prisma.actionTaken.create({
      data: {
        ticketId: ticket.id, performedById: staffId, actionAt: new Date(),
        description: 'No-op check.', result: 'NO_ACTION_NEEDED', followUpRequired: false,
      },
    });
    const reloaded = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(reloaded.updatedAt.getTime()).toBe(ticket.updatedAt.getTime());
  });

  it('writes an ACTION_TAKEN_ADDED TicketEvent row (schema accepts the new enum value)', async () => {
    const ticket = await createTicket();
    await prisma.ticketEvent.create({
      data: { ticketId: ticket.id, actorId: staffId, eventType: 'ACTION_TAKEN_ADDED' },
    });
    const events = await prisma.ticketEvent.findMany({ where: { ticketId: ticket.id } });
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('ACTION_TAKEN_ADDED');
  });
});
