import { Router } from 'express';
import { prisma } from '../../prisma';
import { HttpError } from '../../middleware/errorEnvelope';
import { ACTION_INCLUDE, ACTION_ORDER, serializeAction } from '../../services/actionTaken';

export const ticketActionsRouter = Router({ mergeParams: true }); // mounted at /tickets/:id/actions

// Read only: this namespace has no POST or PATCH, so those fall through to 404 (api-spec.md 1.1).
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
      orderBy: ACTION_ORDER,
      include: ACTION_INCLUDE,
    });
    res.status(200).json(actions.map(serializeAction));
  } catch (error) {
    next(error);
  }
});
