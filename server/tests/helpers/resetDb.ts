import { prisma } from '../../src/prisma';

export async function truncateTicketTables(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "TicketEvent", "Comment", "Attachment", "Ticket", "TicketCounter" RESTART IDENTITY CASCADE'
  );
}

export async function truncateSessionTable(): Promise<void> {
  await prisma.$executeRawUnsafe('TRUNCATE "Session" RESTART IDENTITY CASCADE');
}
