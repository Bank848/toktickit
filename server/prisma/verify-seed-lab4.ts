import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const zeroActionTicket = await prisma.ticket.findUnique({
    where: { ticketNo: 'TKT-2025-00002' },
    include: { _count: { select: { actionsTaken: true } } },
  });
  const oneActionTicket = await prisma.ticket.findUnique({
    where: { ticketNo: 'TKT-2025-00003' },
    include: { _count: { select: { actionsTaken: true } } },
  });
  const multiActionTicket = await prisma.ticket.findUnique({
    where: { ticketNo: 'TKT-2025-00004' },
    include: { actionsTaken: true },
  });
  const followUpAction = await prisma.actionTaken.findFirst({ where: { followUpRequired: true } });
  const unassigned = await prisma.ticket.count({ where: { ownerId: null } });
  const ownedByStaff1 = await prisma.ticket.count({
    where: { owner: { email: 'itstaff@toktickit.local' } },
  });
  const distinctStatuses = await prisma.ticket.groupBy({ by: ['status'] });
  const distinctPriorities = await prisma.ticket.groupBy({ by: ['itPriority'] });
  const distinctPerformers = multiActionTicket
    ? new Set(multiActionTicket.actionsTaken.map((a) => a.performedById)).size
    : 0;

  console.log(`TKT-2025-00002 action count: ${zeroActionTicket?._count.actionsTaken} (expect 0)`);
  console.log(`TKT-2025-00003 action count: ${oneActionTicket?._count.actionsTaken} (expect 1)`);
  console.log(`TKT-2025-00004 action count: ${multiActionTicket?.actionsTaken.length} (expect >= 2)`);
  console.log(`TKT-2025-00004 distinct performers: ${distinctPerformers} (expect >= 2)`);
  console.log(`ActionTaken rows with followUpRequired=true: ${followUpAction ? 1 : 0} (expect >= 1)`);
  console.log(`Unassigned tickets: ${unassigned} (expect >= 1)`);
  console.log(`Tickets owned by itstaff@toktickit.local: ${ownedByStaff1} (expect >= 1)`);
  console.log(`Distinct ticket statuses seeded: ${distinctStatuses.length} (expect 8)`);
  console.log(`Distinct IT priorities seeded: ${distinctPriorities.length} (expect 4)`);

  if (
    zeroActionTicket?._count.actionsTaken !== 0 ||
    (oneActionTicket?._count.actionsTaken ?? 0) !== 1 ||
    (multiActionTicket?.actionsTaken.length ?? 0) < 2 ||
    distinctPerformers < 2 ||
    !followUpAction ||
    unassigned < 1 ||
    ownedByStaff1 < 1 ||
    distinctStatuses.length !== 8 ||
    distinctPriorities.length !== 4
  ) {
    console.error('Lab 4 seed verification FAILED.');
    process.exit(1);
  }
  console.log('Lab 4 seed verification passed.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
