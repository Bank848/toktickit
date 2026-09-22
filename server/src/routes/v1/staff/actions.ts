import { Router } from 'express';
import { prisma } from '../../../prisma';
import { HttpError, ValidationHttpError } from '../../../middleware/errorEnvelope';
import { validateCreateActionTakenRequest, validateUpdateActionTakenRequest } from '../../../validators/actionTakenRequest';
import { findTicketOrThrow } from './shared';

export const staffActionsRouter = Router({ mergeParams: true }); // mounted at /staff/tickets/:id/actions

const TERMINAL_STATUSES = ['CLOSED', 'CANCELLED'] as const;

const ACTION_INCLUDE = {
  performedBy: { select: { id: true, displayName: true } },
  lastEditedBy: { select: { id: true, displayName: true } },
} as const;

function serializeAction(action: {
  id: string; ticketId: string; actionAt: Date; description: string; result: string;
  followUpRequired: boolean; followUpNote: string | null; attachmentNotes: string | null;
  createdAt: Date; updatedAt: Date;
  performedBy: { id: string; displayName: string };
  lastEditedBy: { id: string; displayName: string } | null;
}) {
  return {
    id: action.id, ticketId: action.ticketId, performedBy: action.performedBy, lastEditedBy: action.lastEditedBy,
    actionAt: action.actionAt, description: action.description, result: action.result,
    followUpRequired: action.followUpRequired, followUpNote: action.followUpNote, attachmentNotes: action.attachmentNotes,
    createdAt: action.createdAt, updatedAt: action.updatedAt,
  };
}

staffActionsRouter.get<{ id: string }>('/', async (req, res, next) => {
  try {
    const ticket = await findTicketOrThrow(req.params.id);
    const actions = await prisma.actionTaken.findMany({
      where: { ticketId: ticket.id },
      orderBy: { createdAt: 'asc' },
      include: ACTION_INCLUDE,
    });
    res.status(200).json(actions.map(serializeAction));
  } catch (error) {
    next(error);
  }
});

staffActionsRouter.post<{ id: string }>('/', async (req, res, next) => {
  try {
    const validated = validateCreateActionTakenRequest(req.body ?? {});
    if (!validated.ok) throw new ValidationHttpError(validated.errors);

    const ticket = await findTicketOrThrow(req.params.id);
    if (TERMINAL_STATUSES.includes(ticket.status as never)) {
      throw new HttpError(409, 'TICKET_LOCKED', 'Cannot record an Action Taken on a Closed or Cancelled ticket');
    }

    const { actionAt, description, result, followUpRequired, followUpNote, attachmentNotes } = validated.value;
    const created = await prisma.$transaction(async (tx) => {
      const action = await tx.actionTaken.create({
        data: {
          ticketId: ticket.id, performedById: req.user!.id, actionAt, description, result,
          followUpRequired, followUpNote, attachmentNotes,
        },
        include: ACTION_INCLUDE,
      });
      await tx.ticketEvent.create({
        data: { ticketId: ticket.id, actorId: req.user!.id, eventType: 'ACTION_TAKEN_ADDED', payload: { actionId: action.id } },
      });
      return action;
    });

    res.status(201).json(serializeAction(created));
  } catch (error) {
    next(error);
  }
});

staffActionsRouter.patch<{ id: string; actionId: string }>('/:actionId', async (req, res, next) => {
  try {
    const validated = validateUpdateActionTakenRequest(req.body ?? {});
    if (!validated.ok) throw new ValidationHttpError(validated.errors);

    const ticket = await findTicketOrThrow(req.params.id);
    if (TERMINAL_STATUSES.includes(ticket.status as never)) {
      throw new HttpError(409, 'TICKET_LOCKED', 'Cannot edit an Action Taken on a Closed or Cancelled ticket');
    }

    const existing = await prisma.actionTaken.findUnique({ where: { id: req.params.actionId } });
    if (!existing || existing.ticketId !== ticket.id) {
      throw new HttpError(404, 'ACTION_NOT_FOUND', 'Action Taken not found');
    }

    const { actionAt, description, result, followUpRequired, followUpNote, attachmentNotes } = validated.value;
    const updated = await prisma.$transaction(async (tx) => {
      // BR-03: performedById is never part of this write -- only lastEditedById changes.
      const action = await tx.actionTaken.update({
        where: { id: existing.id },
        data: {
          actionAt, description, result, followUpRequired, followUpNote, attachmentNotes,
          lastEditedById: req.user!.id,
        },
        include: ACTION_INCLUDE,
      });
      await tx.ticketEvent.create({
        data: { ticketId: ticket.id, actorId: req.user!.id, eventType: 'ACTION_TAKEN_UPDATED', payload: { actionId: action.id } },
      });
      return action;
    });

    res.status(200).json(serializeAction(updated));
  } catch (error) {
    next(error);
  }
});
