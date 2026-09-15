import { Router } from 'express';
import { prisma } from '../../../prisma';
import { ValidationHttpError } from '../../../middleware/errorEnvelope';
import { findTicketOrThrow } from './shared';

export const staffCommentsRouter = Router({ mergeParams: true }); // mounted at /staff/tickets/:id/comments

function serializeComment(comment: { id: string; ticketId: string; body: string; createdAt: Date; author: { id: string; displayName: string; role: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR' } }) {
  return {
    id: comment.id, ticketId: comment.ticketId, body: comment.body,
    author: { id: comment.author.id, displayName: comment.author.displayName },
    authorRole: comment.author.role,
    createdAt: comment.createdAt,
  };
}

staffCommentsRouter.get<{ id: string }>('/', async (req, res, next) => {
  try {
    const ticket = await findTicketOrThrow(req.params.id);
    const comments = await prisma.comment.findMany({
      where: { ticketId: ticket.id },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { id: true, displayName: true, role: true } } },
    });
    res.status(200).json(comments.map(serializeComment));
  } catch (error) {
    next(error);
  }
});

staffCommentsRouter.post<{ id: string }>('/', async (req, res, next) => {
  try {
    const { body, problemAppearsResolved } = req.body ?? {};
    if (problemAppearsResolved !== undefined) {
      // A-08/api-spec.md #22: only the Requester endpoint accepts this flag.
      throw new ValidationHttpError([{ field: 'problemAppearsResolved', message: 'problemAppearsResolved is not accepted on this endpoint' }]);
    }
    const trimmed = typeof body === 'string' ? body.trim() : '';
    if (trimmed.length < 1 || trimmed.length > 2000) {
      throw new ValidationHttpError([{ field: 'body', message: 'body is required, 1-2000 characters' }]);
    }

    const ticket = await findTicketOrThrow(req.params.id);
    const created = await prisma.comment.create({
      data: { ticketId: ticket.id, authorId: req.user!.id, body: trimmed },
      include: { author: { select: { id: true, displayName: true, role: true } } },
    });
    res.status(201).json(serializeComment(created));
  } catch (error) {
    next(error);
  }
});
