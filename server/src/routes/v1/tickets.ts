import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma';
import { resolveCurrentUser } from '../../auth/currentUser';
import { validateCreateTicketRequest } from '../../validators/createTicketRequest';
import { generateTicketNumber } from '../../services/ticketNumber';
import { HttpError, ValidationHttpError } from '../../middleware/errorEnvelope';

export const ticketsRouter = Router();

ticketsRouter.post('/', resolveCurrentUser, async (req, res, next) => {
  try {
    const validated = validateCreateTicketRequest(req.body ?? {});
    if (!validated.ok) {
      throw new ValidationHttpError(validated.errors);
    }
    const { summary, description, categoryId, relatedSystemId, requestedPriority } = validated.value;

    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category || !category.isActive) {
      throw new ValidationHttpError([{ field: 'categoryId', message: 'categoryId must reference an active category' }]);
    }

    if (relatedSystemId !== null) {
      const relatedSystem = await prisma.relatedSystem.findUnique({ where: { id: relatedSystemId } });
      if (!relatedSystem || !relatedSystem.isActive) {
        throw new ValidationHttpError([
          { field: 'relatedSystemId', message: 'relatedSystemId must reference an active related system' },
        ]);
      }
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
      commentCount: 0,
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
    // the relatedSystem FK (P2003), meaning the row was deleted between the pre-check above
    // and the insert -- a genuine race, not a server bug. Everything else (an unrelated Prisma
    // error, a DB connectivity failure, a bug) must fall through to errorEnvelope's generic
    // 500/INTERNAL_ERROR path unchanged. Silently relabeling arbitrary failures as "your
    // relatedSystemId doesn't exist" would hide real errors behind a misleading, specific
    // client-facing message -- exactly what "never silently swallow errors" forbids.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003' &&
      (error.meta?.field_name as string | undefined)?.includes('relatedSystemId')
    ) {
      next(new ValidationHttpError([{ field: 'relatedSystemId', message: 'Referenced record no longer exists' }]));
      return;
    }
    next(error);
  }
});
