import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../prisma';
import { validateStaffListTicketsQuery } from '../../../validators/staffListTicketsQuery';
import { ValidationHttpError, HttpError } from '../../../middleware/errorEnvelope';

export const staffTicketsRouter = Router();

staffTicketsRouter.get('/', async (req, res, next) => {
  try {
    const validated = validateStaffListTicketsQuery(req.query as Record<string, unknown>);
    if (!validated.ok) throw new ValidationHttpError(validated.errors);
    const { status, itPriority, ownerId, q, page, pageSize, sort } = validated.value;

    let ownerFilter: Prisma.TicketWhereInput = {};
    if (ownerId === 'unassigned') {
      ownerFilter = { ownerId: null };
    } else if (ownerId !== null) {
      const owner = await prisma.user.findUnique({ where: { id: ownerId } });
      if (!owner) {
        throw new ValidationHttpError([{ field: 'ownerId', message: 'ownerId must be a real user id or "unassigned"' }]);
      }
      ownerFilter = { ownerId };
    }

    const [sortField, sortDirection] = sort.split(':') as [string, 'asc' | 'desc'];

    const where: Prisma.TicketWhereInput = {
      // No requesterId scoping here on purpose -- IT Staff sees every ticket (FR-15, AC-15).
      ...(status.length > 0 ? { status: { in: status as never[] } } : {}),
      ...(itPriority !== null ? { itPriority } : {}),
      ...ownerFilter,
      ...(q !== null
        ? { OR: [{ ticketNo: { contains: q, mode: 'insensitive' } }, { summary: { contains: q, mode: 'insensitive' } }] }
        : {}),
    };

    const [total, tickets] = await Promise.all([
      prisma.ticket.count({ where }),
      prisma.ticket.findMany({
        where,
        orderBy: { [sortField]: sortDirection },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          category: { select: { id: true, name: true } },
          owner: { select: { id: true, displayName: true } },
          _count: { select: { attachments: { where: { deletedAt: null } } } },
        },
      }),
    ]);

    res.status(200).json({
      data: tickets.map((t) => ({
        id: t.id, ticketNo: t.ticketNo, summary: t.summary, category: t.category,
        status: t.status, requestedPriority: t.requestedPriority, itPriority: t.itPriority,
        createdAt: t.createdAt, updatedAt: t.updatedAt, attachmentCount: t._count.attachments,
        owner: t.owner,
      })),
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    });
  } catch (error) {
    next(error);
  }
});

const STAFF_TICKET_INCLUDE = {
  category: { select: { id: true, name: true } },
  relatedSystem: { select: { id: true, name: true } },
  requester: { select: { id: true, displayName: true } },
  owner: { select: { id: true, displayName: true } },
  _count: { select: { attachments: { where: { deletedAt: null } } } },
} as const;

function serializeStaffTicketDetail(ticket: Prisma.TicketGetPayload<{ include: typeof STAFF_TICKET_INCLUDE }>) {
  return {
    id: ticket.id, ticketNo: ticket.ticketNo, summary: ticket.summary, description: ticket.description,
    category: ticket.category, relatedSystem: ticket.relatedSystem, status: ticket.status,
    requestedPriority: ticket.requestedPriority, itPriority: ticket.itPriority,
    createdAt: ticket.createdAt, updatedAt: ticket.updatedAt, attachmentCount: ticket._count.attachments,
    requester: ticket.requester, owner: ticket.owner, resolutionSummary: ticket.resolutionSummary,
    version: ticket.version,
  };
}

async function findTicketOrThrow(id: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id }, include: STAFF_TICKET_INCLUDE });
  if (!ticket) {
    // Unlike the Requester routes, there is no ownership to hide here (api-spec.md §1.3):
    // every ticket is visible to any IT Staff caller, so 404 means only "doesn't exist."
    throw new HttpError(404, 'TICKET_NOT_FOUND', 'Ticket not found');
  }
  return ticket;
}

staffTicketsRouter.get('/:id', async (req, res, next) => {
  try {
    const ticket = await findTicketOrThrow(req.params.id);
    res.status(200).json(serializeStaffTicketDetail(ticket));
  } catch (error) {
    next(error);
  }
});
