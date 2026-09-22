import { Router } from 'express';
import { prisma } from '../../prisma';
import { HttpError } from '../../middleware/errorEnvelope';

export const ticketActionsRouter = Router({ mergeParams: true }); // mounted at /tickets/:id/actions

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

ticketActionsRouter.get<{ id: string }>('/', async (req, res, next) => {
  try {
    const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
    if (!ticket || ticket.requesterId !== req.user!.id) {
      // Same identical-body-for-both-cases rule as GET /tickets/:id (D-24): a 403 here would
      // confirm the ticket's existence to a caller who doesn't own it.
      throw new HttpError(404, 'TICKET_NOT_ACCESSIBLE', 'Ticket not found');
    }
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
