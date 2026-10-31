import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { prisma } from '../../src/prisma';
import { truncateTicketTables } from '../helpers/resetDb';
import { generateTicketNumber } from '../../src/services/ticketNumber';
import { getRequesterDashboard, getStaffDashboard, ALL_STATUSES } from '../../src/services/dashboardMetrics';

describe('dashboardMetrics service', () => {
  let requesterId: string;
  let requester2Id: string;
  let staffId: string;
  let staff2Id: string;
  let categoryId: number;

  beforeAll(async () => {
    requesterId = (await prisma.user.findFirstOrThrow({ where: { role: 'REQUESTER' }, orderBy: { email: 'asc' } })).id;
    requester2Id = (await prisma.user.findFirstOrThrow({ where: { role: 'REQUESTER', id: { not: requesterId } }, orderBy: { email: 'asc' } })).id;
    staffId = (await prisma.user.findFirstOrThrow({ where: { role: 'IT_STAFF' }, orderBy: { email: 'asc' } })).id;
    staff2Id = (await prisma.user.findFirstOrThrow({ where: { role: 'IT_STAFF', id: { not: staffId } }, orderBy: { email: 'asc' } })).id;
    categoryId = (await prisma.category.findFirstOrThrow({ where: { isActive: true } })).id;
  });

  beforeEach(async () => {
    await truncateTicketTables();
  });

  async function createTicket(status: string, opts: { ownerId?: string | null; itPriority?: string; requesterId?: string } = {}) {
    const ticketNo = await generateTicketNumber(prisma, new Date().getUTCFullYear());
    return prisma.ticket.create({
      data: {
        ticketNo, summary: `Ticket in ${status}`, description: 'desc',
        status: status as never, requestedPriority: 'MEDIUM', itPriority: (opts.itPriority ?? 'MEDIUM') as never,
        requesterId: opts.requesterId ?? requesterId, categoryId, ownerId: opts.ownerId ?? null,
      },
    });
  }

  it('UNIT-13/AC-12: a fresh Requester with zero Tickets gets every status count as 0 and an empty recentTickets array', async () => {
    const result = await getRequesterDashboard(requesterId);
    expect(ALL_STATUSES.every((s) => result.statusCounts[s] === 0)).toBe(true);
    expect(result.recentTickets).toEqual([]);
  });

  it('UNIT-14/AC-02: only counts and recent Tickets owned by the given Requester are returned', async () => {
    await createTicket('OPEN', { requesterId });
    await createTicket('OPEN', { requesterId: requester2Id });
    const result = await getRequesterDashboard(requesterId);
    expect(result.statusCounts.OPEN).toBe(1);
    expect(result.recentTickets).toHaveLength(1);
  });

  it('UNIT-15: caps recentTickets at 5, newest updatedAt first', async () => {
    const created = [];
    for (let i = 0; i < 7; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      created.push(await createTicket('OPEN', { requesterId }));
    }
    // Make creation order differ from updatedAt order: the first-created ticket is the newest.
    await prisma.ticket.update({ where: { id: created[0].id }, data: { updatedAt: new Date('2030-01-01T00:00:00.000Z') } });
    const result = await getRequesterDashboard(requesterId);
    expect(result.recentTickets).toHaveLength(5);
    expect(result.recentTickets[0].id).toBe(created[0].id);
    const times = result.recentTickets.map((t) => t.updatedAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it('UNIT-17/FR-08: ownedByMeCount counts every status, including CLOSED and CANCELLED -- unlike unassignedCount, FR-08 states no status qualifier for this metric', async () => {
    await createTicket('IN_PROGRESS', { ownerId: staffId });
    await createTicket('CLOSED', { ownerId: staffId });
    await createTicket('CANCELLED', { ownerId: staffId });
    const result = await getStaffDashboard(staffId, false);
    expect(result.ownedByMeCount).toBe(3);
  });

  it('UNIT-16/AC-10: unassignedCount matches a direct count of ownerId=null AND non-terminal status', async () => {
    await createTicket('NEW', { ownerId: null });
    await createTicket('OPEN', { ownerId: null });
    await createTicket('CLOSED', { ownerId: null }); // excluded: terminal
    await createTicket('OPEN', { ownerId: staffId }); // excluded: assigned
    const result = await getStaffDashboard(staffId, false);
    expect(result.unassignedCount).toBe(2);
  });

  it('ownedByMeCount is scoped to the given user id, not any other IT Staff', async () => {
    await createTicket('IN_PROGRESS', { ownerId: staffId });
    await createTicket('IN_PROGRESS', { ownerId: staff2Id });
    const result = await getStaffDashboard(staffId, false);
    expect(result.ownedByMeCount).toBe(1);
  });

  it('UNIT-18/BR-12: two different staff users each see only their own ownedByMeCount', async () => {
    await createTicket('IN_PROGRESS', { ownerId: staffId });
    await createTicket('IN_PROGRESS', { ownerId: staff2Id });
    await createTicket('IN_PROGRESS', { ownerId: staff2Id });
    const staff1Result = await getStaffDashboard(staffId, false);
    const staff2Result = await getStaffDashboard(staff2Id, false);
    expect(staff1Result.ownedByMeCount).toBe(1);
    expect(staff2Result.ownedByMeCount).toBe(2);
  });

  it('UNIT-19: statusCounts and priorityCounts on the staff dashboard span all Requesters, zero-filled for absent values', async () => {
    await createTicket('OPEN', { itPriority: 'URGENT' });
    const result = await getStaffDashboard(staffId, false);
    expect(result.statusCounts.OPEN).toBe(1);
    expect(result.statusCounts.CLOSED).toBe(0);
    expect(result.priorityCounts.URGENT).toBe(1);
    expect(result.priorityCounts.LOW).toBe(0);
  });

  it('FR-09/AC-11: userCounts is populated only when requested, covers all 3 roles and never counts an inactive user', async () => {
    const extraIds: string[] = [];
    try {
      for (const role of ['REQUESTER', 'IT_STAFF', 'ADMINISTRATOR'] as const) {
        // eslint-disable-next-line no-await-in-loop
        const user = await prisma.user.create({
          data: { email: `inactive-${role.toLowerCase()}@metrics.test`, displayName: 'Inactive', role, isActive: false },
        });
        extraIds.push(user.id);
      }
      const withCounts = await getStaffDashboard(staffId, true);
      expect(Object.keys(withCounts.userCounts ?? {}).sort()).toEqual(['ADMINISTRATOR', 'IT_STAFF', 'REQUESTER']);
      for (const role of ['REQUESTER', 'IT_STAFF', 'ADMINISTRATOR'] as const) {
        // eslint-disable-next-line no-await-in-loop
        const active = await prisma.user.count({ where: { role, isActive: true } });
        expect(withCounts.userCounts?.[role]).toBe(active);
      }
      const withoutCounts = await getStaffDashboard(staffId, false);
      expect(withoutCounts.userCounts).toBeNull();
    } finally {
      await prisma.user.deleteMany({ where: { id: { in: extraIds } } });
    }
  });
});
