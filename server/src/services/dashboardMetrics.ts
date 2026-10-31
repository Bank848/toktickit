import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import type { TicketStatus } from './ticketStatusTransitions';

export const ALL_STATUSES: TicketStatus[] = [
  'NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED',
];
const ALL_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
const ALL_ROLES = ['REQUESTER', 'IT_STAFF', 'ADMINISTRATOR'] as const;
const NON_TERMINAL_STATUSES = ALL_STATUSES.filter((s) => s !== 'CLOSED' && s !== 'CANCELLED');
const RECENT_LIMIT = 5;

interface RecentTicketSummary {
  id: string;
  ticketNo: string;
  summary: string;
  status: string;
  updatedAt: Date;
}

// updatedAt desc, then id desc, so tickets sharing an updatedAt come back in a stable order (api-spec 2.3).
const RECENT_ORDER: Prisma.TicketOrderByWithRelationInput[] = [{ updatedAt: 'desc' }, { id: 'desc' }];
const RECENT_SELECT = { id: true, ticketNo: true, summary: true, status: true, updatedAt: true } as const;

// Three separate zero-fill helpers, not one generic one: Prisma's groupBy result type differs
// per `by` field, so a single generic helper would need an unsafe cast at each call site.
function zeroFillStatusCounts(rows: { status: string; _count: { status: number } }[]): Record<string, number> {
  const result: Record<string, number> = Object.fromEntries(ALL_STATUSES.map((s) => [s, 0]));
  for (const row of rows) result[row.status] = row._count.status;
  return result;
}

function zeroFillPriorityCounts(rows: { itPriority: string; _count: { itPriority: number } }[]): Record<string, number> {
  const result: Record<string, number> = Object.fromEntries(ALL_PRIORITIES.map((p) => [p, 0]));
  for (const row of rows) result[row.itPriority] = row._count.itPriority;
  return result;
}

function zeroFillRoleCounts(rows: { role: string; _count: { role: number } }[]): Record<string, number> {
  const result: Record<string, number> = Object.fromEntries(ALL_ROLES.map((r) => [r, 0]));
  for (const row of rows) result[row.role] = row._count.role;
  return result;
}

export async function getRequesterDashboard(requesterId: string) {
  const [statusRows, recentTickets] = await Promise.all([
    prisma.ticket.groupBy({ by: ['status'], where: { requesterId }, _count: { status: true } }),
    prisma.ticket.findMany({
      where: { requesterId }, orderBy: RECENT_ORDER, take: RECENT_LIMIT, select: RECENT_SELECT,
    }),
  ]);
  return {
    statusCounts: zeroFillStatusCounts(statusRows),
    recentTickets: recentTickets as RecentTicketSummary[],
  };
}

export async function getStaffDashboard(currentUserId: string, includeUserCounts: boolean) {
  const [unassignedCount, ownedByMeCount, statusRows, priorityRows, recentTickets, userRoleRows] = await Promise.all([
    prisma.ticket.count({ where: { ownerId: null, status: { in: NON_TERMINAL_STATUSES as never[] } } }),
    // No status filter here (unlike unassignedCount above): FR-08 defines this metric as
    // "Tickets owned by the authenticated user" with no non-terminal qualifier, and AC-10's
    // non-terminal requirement is stated only for the unassigned metric.
    prisma.ticket.count({ where: { ownerId: currentUserId } }),
    prisma.ticket.groupBy({ by: ['status'], _count: { status: true } }),
    prisma.ticket.groupBy({ by: ['itPriority'], _count: { itPriority: true } }),
    prisma.ticket.findMany({ orderBy: RECENT_ORDER, take: RECENT_LIMIT, select: RECENT_SELECT }),
    includeUserCounts
      ? prisma.user.groupBy({ by: ['role'], where: { isActive: true }, _count: { role: true } })
      : Promise.resolve(null),
  ]);

  return {
    unassignedCount,
    ownedByMeCount,
    statusCounts: zeroFillStatusCounts(statusRows),
    priorityCounts: zeroFillPriorityCounts(priorityRows),
    recentTickets: recentTickets as RecentTicketSummary[],
    userCounts: userRoleRows ? zeroFillRoleCounts(userRoleRows) : null,
  };
}
