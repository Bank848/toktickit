import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../prisma';
import { validateStaffListTicketsQuery } from '../../../validators/staffListTicketsQuery';
import { ValidationHttpError, HttpError } from '../../../middleware/errorEnvelope';
import { isValidTransition, STATUS_TRANSITIONS, type TicketStatus } from '../../../services/ticketStatusTransitions';
import { STAFF_TICKET_INCLUDE, serializeStaffTicketDetail, findTicketOrThrow } from './shared';
import { staffCommentsRouter } from './comments';
import { staffNotesRouter } from './notes';

export const staffTicketsRouter = Router();

staffTicketsRouter.use('/:id/comments', staffCommentsRouter);
staffTicketsRouter.use('/:id/notes', staffNotesRouter);

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

staffTicketsRouter.get('/:id', async (req, res, next) => {
  try {
    const ticket = await findTicketOrThrow(req.params.id);
    res.status(200).json(serializeStaffTicketDetail(ticket));
  } catch (error) {
    next(error);
  }
});

const TERMINAL_STATUSES = ['CLOSED', 'CANCELLED'] as const;

staffTicketsRouter.patch('/:id/owner', async (req, res, next) => {
  try {
    const { ownerId } = req.body ?? {};
    if (typeof ownerId !== 'string' || ownerId.trim().length === 0) {
      throw new ValidationHttpError([{ field: 'ownerId', message: 'ownerId is required' }]);
    }

    const ticket = await findTicketOrThrow(req.params.id);

    if (TERMINAL_STATUSES.includes(ticket.status as never)) {
      // BR-19: CLOSED/CANCELLED tickets accept no ownership change, no exception for owner
      // (the CLOSED->REOPENED exception only applies to the status endpoint, api-spec.md #19/#20).
      throw new HttpError(409, 'TICKET_LOCKED', 'Cannot change ownership on a Closed or Cancelled ticket');
    }

    const owner = await prisma.user.findUnique({ where: { id: ownerId } });
    if (!owner || !owner.isActive || (owner.role !== 'IT_STAFF' && owner.role !== 'ADMINISTRATOR')) {
      throw new HttpError(409, 'INVALID_OWNER', 'ownerId must reference an active IT Staff or Administrator user');
    }

    const updated = await prisma.$transaction(async (tx) => {
      // BR-15: NEW -> OPEN happens only as the side effect of the FIRST ownership assignment,
      // in the same transaction as the ownerId write -- this is the only code path that ever
      // moves a ticket out of NEW (api-spec.md #18).
      const nextStatus = ticket.status === 'NEW' ? 'OPEN' : undefined;
      return tx.ticket.update({
        where: { id: ticket.id },
        data: { ownerId: owner.id, ...(nextStatus ? { status: nextStatus } : {}) },
        include: STAFF_TICKET_INCLUDE,
      });
    });

    res.status(200).json(serializeStaffTicketDetail(updated));
  } catch (error) {
    next(error);
  }
});

const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

staffTicketsRouter.patch('/:id/priority', async (req, res, next) => {
  try {
    const { itPriority } = req.body ?? {};
    if (typeof itPriority !== 'string' || !VALID_PRIORITIES.includes(itPriority)) {
      throw new ValidationHttpError([{ field: 'itPriority', message: 'itPriority must be one of ' + VALID_PRIORITIES.join(', ') }]);
    }

    const ticket = await findTicketOrThrow(req.params.id);
    if (TERMINAL_STATUSES.includes(ticket.status as never)) {
      throw new HttpError(409, 'TICKET_LOCKED', 'Cannot change IT Priority on a Closed or Cancelled ticket');
    }

    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: { itPriority: itPriority as never },
      include: STAFF_TICKET_INCLUDE,
    });
    res.status(200).json(serializeStaffTicketDetail(updated));
  } catch (error) {
    next(error);
  }
});

// All 8 known TicketStatus values (including NEW). NEW is never a *valid transition target*
// (STATUS_TRANSITIONS has no row that lists it as a destination -- isValidTransition() below
// rejects it with 409 INVALID_STATUS_TRANSITION), but it is still a recognized status string, so
// it must not be turned away as a 422 VALIDATION_FAILED input the way a genuinely unknown string
// like "ON_HOLD" is (api-spec.md #20's UpdateStatusRequest comment covers the "never a valid
// target" business rule, not the request-shape validation layer).
const ALL_KNOWN_STATUSES = Object.keys(STATUS_TRANSITIONS) as TicketStatus[];

staffTicketsRouter.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body ?? {};
    if (typeof status !== 'string' || !ALL_KNOWN_STATUSES.includes(status as TicketStatus)) {
      throw new ValidationHttpError([{ field: 'status', message: 'status must be one of ' + ALL_KNOWN_STATUSES.join(', ') }]);
    }

    const ticket = await findTicketOrThrow(req.params.id);
    const from = ticket.status as TicketStatus;
    const to = status as TicketStatus;

    if (!isValidTransition(from, to)) {
      // Same distinction as the /priority endpoint (Task 22, Step 6.3): a rejected transition
      // out of a terminal status (CLOSED/CANCELLED) is a lock violation, not a generic invalid
      // transition -- api-spec.md requires TICKET_LOCKED here specifically. The one still-valid
      // escape out of a terminal status, CLOSED -> REOPENED, is accepted by isValidTransition()
      // above and never reaches this branch, so it is unaffected.
      if (TERMINAL_STATUSES.includes(from as never)) {
        throw new HttpError(409, 'TICKET_LOCKED', `Cannot change status on a ${from} ticket`);
      }
      throw new HttpError(409, 'INVALID_STATUS_TRANSITION', `Cannot change status from ${from} to ${to}`);
    }

    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: to },
      include: STAFF_TICKET_INCLUDE,
    });
    res.status(200).json(serializeStaffTicketDetail(updated));
  } catch (error) {
    next(error);
  }
});
