import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BCRYPT_COST = 10;

// Fixed local-dev password shared by every seeded account except the one seeded specifically to
// exercise the mandatory first-login flow (docs/lab-03/specification.md §6.2). Local development
// only — never a real personal password or production secret. Documented in README.md.
const DEV_PASSWORD = 'DevPass123!';
const DEV_PASSWORD_HASH = bcrypt.hashSync(DEV_PASSWORD, BCRYPT_COST);

const CATEGORIES: { name: string; code: string }[] = [
  { name: 'Account and Access', code: 'ACCESS' },
  { name: 'Hardware', code: 'HARDWARE' },
  { name: 'Software', code: 'SOFTWARE' },
  { name: 'Network', code: 'NETWORK' },
];

const RELATED_SYSTEMS: { code: string; name: string; isActive: boolean }[] = [
  { code: 'CORP_LAPTOP', name: 'Corporate Laptop', isActive: true },
  { code: 'EMAIL', name: 'Email', isActive: true },
  { code: 'VPN', name: 'VPN', isActive: true },
  { code: 'PRINTER', name: 'Printer', isActive: true },
  { code: 'ERP', name: 'ERP', isActive: true },
  { code: 'LEGACY_FS', name: 'Legacy File Server', isActive: false },
];

const USERS: {
  email: string;
  displayName: string;
  role: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR';
  isActive: boolean;
  mustChangePassword: boolean;
}[] = [
  { email: 'requester@toktickit.local', displayName: 'Nattapong R.', role: 'REQUESTER', isActive: true, mustChangePassword: false },
  { email: 'requester2@toktickit.local', displayName: 'Siriporn K.', role: 'REQUESTER', isActive: true, mustChangePassword: false },
  { email: 'requester3@toktickit.local', displayName: 'Somchai P.', role: 'REQUESTER', isActive: true, mustChangePassword: false },
  { email: 'requester4@toktickit.local', displayName: 'Malee T.', role: 'REQUESTER', isActive: true, mustChangePassword: false },
  { email: 'requester5-inactive@toktickit.local', displayName: 'Wichai S. (inactive)', role: 'REQUESTER', isActive: false, mustChangePassword: false },
  { email: 'itstaff@toktickit.local', displayName: 'IT Support', role: 'IT_STAFF', isActive: true, mustChangePassword: false },
  { email: 'itstaff2@toktickit.local', displayName: 'Pakorn W.', role: 'IT_STAFF', isActive: true, mustChangePassword: false },
  { email: 'itstaff3@toktickit.local', displayName: 'Suda N.', role: 'IT_STAFF', isActive: true, mustChangePassword: false },
  { email: 'itstaff4-inactive@toktickit.local', displayName: 'Anan C. (inactive)', role: 'IT_STAFF', isActive: false, mustChangePassword: false },
  { email: 'admin@toktickit.local', displayName: 'System Admin', role: 'ADMINISTRATOR', isActive: true, mustChangePassword: false },
  { email: 'onboarding@toktickit.local', displayName: 'New Hire (must change password)', role: 'IT_STAFF', isActive: true, mustChangePassword: true },
];

async function main() {
  for (const category of CATEGORIES) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: { code: category.code, isActive: true },
      create: { name: category.name, code: category.code, isActive: true },
    });
  }

  for (const system of RELATED_SYSTEMS) {
    await prisma.relatedSystem.upsert({
      where: { code: system.code },
      update: { name: system.name, isActive: system.isActive },
      create: system,
    });
  }

  for (const user of USERS) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        displayName: user.displayName,
        role: user.role,
        isActive: user.isActive,
        passwordHash: DEV_PASSWORD_HASH,
        mustChangePassword: user.mustChangePassword,
      },
      create: {
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        isActive: user.isActive,
        passwordHash: DEV_PASSWORD_HASH,
        mustChangePassword: user.mustChangePassword,
      },
    });
  }

  // AC-12: requester@toktickit.local (a Lab 2 seeded Requester) must carry at least one ticket
  // that predates the Lab 3 migration, so E2E can prove existing Requester tickets survive the
  // move to session-based auth. Upserted by the fixed ticketNo (unique) so re-running the seed
  // never duplicates it.
  const [lab2Requester, networkCategory, vpnSystem] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: 'requester@toktickit.local' } }),
    prisma.category.findUniqueOrThrow({ where: { name: 'Network' } }),
    prisma.relatedSystem.findUniqueOrThrow({ where: { code: 'VPN' } }),
  ]);

  await prisma.ticket.upsert({
    where: { ticketNo: 'TKT-2025-00001' },
    update: {},
    create: {
      ticketNo: 'TKT-2025-00001',
      summary: 'VPN client fails to connect after Windows update',
      description:
        'VPN client shows a certificate error and cannot establish a tunnel since the latest Windows update was applied.',
      status: 'OPEN',
      requestedPriority: 'MEDIUM',
      itPriority: 'MEDIUM',
      requesterId: lab2Requester.id,
      categoryId: networkCategory.id,
      relatedSystemId: vpnSystem.id,
    },
  });

  const [itStaff1, itStaff2, itStaff3, softwareCategory, accessCategory, hardwareCategory, emailSystem, corpLaptop] =
    await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { email: 'itstaff@toktickit.local' } }),
      prisma.user.findUniqueOrThrow({ where: { email: 'itstaff2@toktickit.local' } }),
      prisma.user.findUniqueOrThrow({ where: { email: 'itstaff3@toktickit.local' } }),
      prisma.category.findUniqueOrThrow({ where: { name: 'Software' } }),
      prisma.category.findUniqueOrThrow({ where: { name: 'Account and Access' } }),
      prisma.category.findUniqueOrThrow({ where: { name: 'Hardware' } }),
      prisma.relatedSystem.findUniqueOrThrow({ where: { code: 'EMAIL' } }),
      prisma.relatedSystem.findUniqueOrThrow({ where: { code: 'CORP_LAPTOP' } }),
    ]);

  // AC-04 demonstration: zero Action Taken records, so a direct RESOLVED transition attempt
  // against this ticket must be rejected (FR-06/BR-09).
  const zeroActionTicket = await prisma.ticket.upsert({
    where: { ticketNo: 'TKT-2025-00002' },
    update: {},
    create: {
      ticketNo: 'TKT-2025-00002', summary: 'New laptop request pending approval',
      description: 'Requesting a replacement laptop for onboarding.',
      status: 'IN_PROGRESS', requestedPriority: 'LOW', itPriority: 'LOW',
      requesterId: lab2Requester.id, categoryId: hardwareCategory.id, ownerId: itStaff1.id,
    },
  });

  // AC-05 demonstration: exactly one Action Taken, the minimum passing case for the gate.
  const oneActionTicket = await prisma.ticket.upsert({
    where: { ticketNo: 'TKT-2025-00003' },
    update: {},
    create: {
      ticketNo: 'TKT-2025-00003', summary: 'Email account locked out',
      description: 'User is locked out of their email account after 3 failed logins.',
      status: 'IN_PROGRESS', requestedPriority: 'HIGH', itPriority: 'HIGH',
      requesterId: lab2Requester.id, categoryId: accessCategory.id, ownerId: itStaff1.id,
      relatedSystemId: emailSystem.id,
    },
  });
  const existingActionOnTkt3 = await prisma.actionTaken.findFirst({ where: { ticketId: oneActionTicket.id } });
  if (!existingActionOnTkt3) {
    await prisma.actionTaken.create({
      data: {
        ticketId: oneActionTicket.id, performedById: itStaff1.id, actionAt: new Date(),
        description: 'Reset the account lockout and verified the user could sign in.',
        result: 'RESOLVED', followUpRequired: false,
      },
    });
  }

  // BR-02 demonstration: multiple Action Taken records authored by different IT Staff, one with
  // followUpRequired=true and a populated note.
  const multiActionTicket = await prisma.ticket.upsert({
    where: { ticketNo: 'TKT-2025-00004' },
    update: {},
    create: {
      ticketNo: 'TKT-2025-00004', summary: 'Intermittent VPN disconnects',
      description: 'VPN drops every 20-30 minutes during video calls.',
      status: 'WAITING_FOR_REQUESTER', requestedPriority: 'MEDIUM', itPriority: 'MEDIUM',
      requesterId: lab2Requester.id, categoryId: softwareCategory.id, ownerId: itStaff2.id,
    },
  });
  const existingActionsOnTkt4 = await prisma.actionTaken.count({ where: { ticketId: multiActionTicket.id } });
  if (existingActionsOnTkt4 < 2) {
    await prisma.actionTaken.create({
      data: {
        ticketId: multiActionTicket.id, performedById: itStaff2.id, actionAt: new Date(),
        description: 'Captured a packet trace during a reproduced disconnect.',
        result: 'PENDING_FOLLOW_UP', followUpRequired: true,
        followUpNote: 'Waiting on network team to review the captured trace.',
      },
    });
    await prisma.actionTaken.create({
      data: {
        ticketId: multiActionTicket.id, performedById: itStaff3.id, actionAt: new Date(),
        description: 'Escalated to the network team with the packet trace attached.',
        result: 'ESCALATED', followUpRequired: false, attachmentNotes: 'Trace file shared via internal drive.',
      },
    });
  }

  // Unassigned + every remaining TicketStatus/Priority combination not already covered above,
  // so every dashboard metric (FR-07..FR-10) has a non-zero seed value at least once.
  const REMAINING: { ticketNo: string; summary: string; status: string; itPriority: string; ownerId: string | null; categoryId: number }[] = [
    { ticketNo: 'TKT-2025-00005', summary: 'New employee needs software installed', status: 'NEW', itPriority: 'MEDIUM', ownerId: null, categoryId: softwareCategory.id },
    { ticketNo: 'TKT-2025-00006', summary: 'Shared drive permissions incorrect', status: 'OPEN', itPriority: 'LOW', ownerId: null, categoryId: accessCategory.id },
    { ticketNo: 'TKT-2025-00007', summary: 'Monitor flickering intermittently', status: 'RESOLVED', itPriority: 'URGENT', ownerId: itStaff1.id, categoryId: hardwareCategory.id },
    { ticketNo: 'TKT-2025-00008', summary: 'Old ticket, already closed out', status: 'CLOSED', itPriority: 'LOW', ownerId: itStaff2.id, categoryId: softwareCategory.id },
    { ticketNo: 'TKT-2025-00009', summary: 'Duplicate request, cancelled', status: 'CANCELLED', itPriority: 'LOW', ownerId: null, categoryId: accessCategory.id },
    { ticketNo: 'TKT-2025-00010', summary: 'Resolved ticket reopened by requester', status: 'REOPENED', itPriority: 'HIGH', ownerId: itStaff3.id, categoryId: hardwareCategory.id },
  ];
  for (const t of REMAINING) {
    const created = await prisma.ticket.upsert({
      where: { ticketNo: t.ticketNo },
      update: {},
      create: {
        ticketNo: t.ticketNo, summary: t.summary, description: `${t.summary}.`,
        status: t.status as never, requestedPriority: t.itPriority as never, itPriority: t.itPriority as never,
        requesterId: lab2Requester.id, categoryId: t.categoryId, ownerId: t.ownerId, relatedSystemId: corpLaptop.id,
      },
    });
    // RESOLVED/CLOSED/REOPENED all require the gate's precondition to have been satisfiable at
    // some point in their own history (specification.md §5's "cycles RESOLVED -> REOPENED ->
    // OPEN" note) -- give each of those three an ActionTaken so the seed itself never violates
    // the rule it's meant to demonstrate.
    if (['RESOLVED', 'CLOSED', 'REOPENED'].includes(t.status)) {
      const already = await prisma.actionTaken.findFirst({ where: { ticketId: created.id } });
      if (!already) {
        await prisma.actionTaken.create({
          data: {
            ticketId: created.id, performedById: itStaff1.id, actionAt: new Date(),
            description: 'Investigated and resolved.', result: 'RESOLVED', followUpRequired: false,
          },
        });
      }
    }
  }

  // Every ticket above was upserted with a hardcoded ticketNo (TKT-2025-00002 .. TKT-2025-00010),
  // bypassing generateTicketNumber's TicketCounter allocation. Sync TicketCounter so the next
  // live-created ticket doesn't collide with one of these seeded numbers.
  const HIGHEST_SEEDED_2025_SEQUENCE = 10; // TKT-2025-00010, the last row in REMAINING above
  const counter2025 = await prisma.ticketCounter.findUnique({ where: { year: 2025 } });
  if (!counter2025 || counter2025.lastValue < HIGHEST_SEEDED_2025_SEQUENCE) {
    await prisma.ticketCounter.upsert({
      where: { year: 2025 },
      update: { lastValue: HIGHEST_SEEDED_2025_SEQUENCE },
      create: { year: 2025, lastValue: HIGHEST_SEEDED_2025_SEQUENCE },
    });
  }
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
