import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma';
import { validateCreateTicketRequest } from '../../validators/createTicketRequest';
import { validateListTicketsQuery } from '../../validators/listTicketsQuery';
import { generateTicketNumber } from '../../services/ticketNumber';
import { HttpError, ValidationHttpError } from '../../middleware/errorEnvelope';
import { ticketAttachmentsRouter } from './attachments';

export const ticketsRouter = Router();

// Prisma's P2003 error names the FK column that failed (e.g. "Ticket_categoryId_fkey"). Both
// categoryId and relatedSystemId go through the same check-then-insert pattern below, so both
// can lose the same race (the referenced row is deleted between the pre-check and the insert) --
// this map lets one catch clause handle either field instead of special-casing just one.
const FK_RACE_FIELDS: Record<string, { field: string; message: string }> = {
  categoryId: { field: 'categoryId', message: 'Referenced record no longer exists' },
  relatedSystemId: { field: 'relatedSystemId', message: 'Referenced record no longer exists' },
};

ticketsRouter.post('/', async (req, res, next) => {
  try {
    const validated = validateCreateTicketRequest(req.body ?? {});
    if (!validated.ok) {
      throw new ValidationHttpError(validated.errors);
    }
    const { summary, description, categoryId, relatedSystemId, requestedPriority } = validated.value;

    const [category, relatedSystem] = await Promise.all([
      prisma.category.findUnique({ where: { id: categoryId } }),
      relatedSystemId !== null
        ? prisma.relatedSystem.findUnique({ where: { id: relatedSystemId } })
        : Promise.resolve(null),
    ]);

    if (!category || !category.isActive) {
      throw new ValidationHttpError([{ field: 'categoryId', message: 'categoryId must reference an active category' }]);
    }

    if (relatedSystemId !== null && (!relatedSystem || !relatedSystem.isActive)) {
      throw new ValidationHttpError([
        { field: 'relatedSystemId', message: 'relatedSystemId must reference an active related system' },
      ]);
    }

    const requesterId = req.user!.id;
    const year = new Date().getUTCFullYear();

    const ticket = await prisma.$transaction(async (tx) => {
      const ticketNo = await generateTicketNumber(tx, year);

      const created = await tx.ticket.create({
        data: {
          ticketNo,
          summary,
          description,
          requestedPriority,
          itPriority: requestedPriority,
          requesterId,
          categoryId,
          relatedSystemId,
        },
        include: {
          category: { select: { id: true, name: true } },
          relatedSystem: { select: { id: true, name: true } },
          requester: { select: { id: true, displayName: true } },
          owner: { select: { id: true, displayName: true } },
        },
      });

      await tx.ticketEvent.create({
        data: {
          ticketId: created.id,
          actorId: requesterId,
          eventType: 'TICKET_CREATED',
        },
      });

      return created;
    });

    res.status(201).json({
      id: ticket.id,
      ticketNo: ticket.ticketNo,
      summary: ticket.summary,
      description: ticket.description,
      category: ticket.category,
      relatedSystem: ticket.relatedSystem,
      status: ticket.status,
      requestedPriority: ticket.requestedPriority,
      itPriority: ticket.itPriority,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      attachmentCount: 0,
      requester: ticket.requester,
      owner: ticket.owner,
      resolutionSummary: ticket.resolutionSummary,
      version: ticket.version,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      next(error);
      return;
    }
    // Only a specific, expected failure gets rewritten to a 422: a foreign-key violation on
    // categoryId or relatedSystemId (P2003), meaning the row was deleted between the pre-check
    // above and the insert -- a genuine race, not a server bug. Everything else (an unrelated
    // Prisma error, a DB connectivity failure, a bug) must fall through to errorEnvelope's
    // generic 500/INTERNAL_ERROR path unchanged. Silently relabeling arbitrary failures as "your
    // field doesn't exist" would hide real errors behind a misleading, specific client-facing
    // message -- exactly what "never silently swallow errors" forbids.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      const fkFieldName = error.meta?.field_name as string | undefined;
      const matchedField = fkFieldName
        ? Object.keys(FK_RACE_FIELDS).find((field) => fkFieldName.includes(field))
        : undefined;
      if (matchedField) {
        next(new ValidationHttpError([FK_RACE_FIELDS[matchedField]]));
        return;
      }
    }
    next(error);
  }
});

ticketsRouter.get('/', async (req, res, next) => {
  try {
    const validated = validateListTicketsQuery(req.query as Record<string, unknown>);
    if (!validated.ok) throw new ValidationHttpError(validated.errors);
    const { status, categoryId, q, page, pageSize, sort } = validated.value;

    const [sortField, sortDirection] = sort.split(':') as [string, 'asc' | 'desc'];

    // requesterId is never taken from the query -- always the authenticated caller (BR-13).
    const where: Prisma.TicketWhereInput = {
      requesterId: req.user!.id,
      ...(status.length > 0 ? { status: { in: status as never[] } } : {}),
      ...(categoryId !== null ? { categoryId } : {}),
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
          _count: { select: { attachments: { where: { deletedAt: null } } } },
        },
      }),
    ]);

    res.status(200).json({
      data: tickets.map((t) => ({
        id: t.id, ticketNo: t.ticketNo, summary: t.summary, category: t.category,
        status: t.status, requestedPriority: t.requestedPriority, itPriority: t.itPriority,
        createdAt: t.createdAt, updatedAt: t.updatedAt, attachmentCount: t._count.attachments,
      })),
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    });
  } catch (error) {
    next(error);
  }
});

ticketsRouter.use('/:id/attachments', ticketAttachmentsRouter);

// Registered after GET / and POST / on this router (Express matches by method+path, so order
// between GET / and POST / doesn't matter, but /:id must stay below any future literal-path
// route, e.g. a hypothetical /search, or that route would never be reached).
ticketsRouter.get('/:id', async (req, res, next) => {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: req.params.id },
      include: {
        category: { select: { id: true, name: true } },
        relatedSystem: { select: { id: true, name: true } },
        requester: { select: { id: true, displayName: true } },
        owner: { select: { id: true, displayName: true } },
        _count: { select: { attachments: { where: { deletedAt: null } } } },
      },
    });
    if (!ticket || ticket.requesterId !== req.user!.id) {
      // Identical body for "doesn't exist" and "exists but isn't yours" -- a 403 here would
      // have confirmed the ticket's existence, which defeats the point (D-24).
      throw new HttpError(404, 'TICKET_NOT_ACCESSIBLE', 'Ticket not found');
    }
    res.status(200).json({
      id: ticket.id,
      ticketNo: ticket.ticketNo,
      summary: ticket.summary,
      description: ticket.description,
      category: ticket.category,
      relatedSystem: ticket.relatedSystem,
      status: ticket.status,
      requestedPriority: ticket.requestedPriority,
      itPriority: ticket.itPriority,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      attachmentCount: ticket._count.attachments,
      requester: ticket.requester,
      owner: ticket.owner,
      resolutionSummary: ticket.resolutionSummary,
      version: ticket.version,
    });
  } catch (error) {
    next(error);
  }
});
