import { Prisma } from '@prisma/client';
import { prisma } from '../../../prisma';
import { HttpError } from '../../../middleware/errorEnvelope';

export const STAFF_TICKET_INCLUDE = {
  category: { select: { id: true, name: true } },
  relatedSystem: { select: { id: true, name: true } },
  requester: { select: { id: true, displayName: true } },
  owner: { select: { id: true, displayName: true } },
  _count: { select: { attachments: { where: { deletedAt: null } } } },
} as const;

export function serializeStaffTicketDetail(ticket: Prisma.TicketGetPayload<{ include: typeof STAFF_TICKET_INCLUDE }>) {
  return {
    id: ticket.id, ticketNo: ticket.ticketNo, summary: ticket.summary, description: ticket.description,
    category: ticket.category, relatedSystem: ticket.relatedSystem, status: ticket.status,
    requestedPriority: ticket.requestedPriority, itPriority: ticket.itPriority,
    createdAt: ticket.createdAt, updatedAt: ticket.updatedAt, attachmentCount: ticket._count.attachments,
    requester: ticket.requester, owner: ticket.owner, resolutionSummary: ticket.resolutionSummary,
    version: ticket.version,
  };
}

export async function findTicketOrThrow(id: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id }, include: STAFF_TICKET_INCLUDE });
  if (!ticket) {
    // Unlike the Requester routes, there is no ownership to hide here (api-spec.md §1.3):
    // every ticket is visible to any IT Staff caller, so 404 means only "doesn't exist."
    throw new HttpError(404, 'TICKET_NOT_FOUND', 'Ticket not found');
  }
  return ticket;
}
