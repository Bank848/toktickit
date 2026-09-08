import { Router } from 'express';
import { prisma } from '../../prisma';
import { validateCreateCommentRequest } from '../../validators/createCommentRequest';
import { HttpError, ValidationHttpError } from '../../middleware/errorEnvelope';

export const ticketCommentsRouter = Router({ mergeParams: true }); // mounted at /tickets/:id/comments

// A-08: this exact literal is the only server-controlled marker for "problem appears resolved"
// -- it is produced here only, never accepted verbatim from the client as flagged text, so a
// client-submitted body that merely starts with the same text (without the boolean flag) is
// stored as ordinary comment text, not specially flagged.
const PROBLEM_RESOLVED_PREFIX = '[Requester marked: problem appears resolved] ';
const MAX_STORED_BODY_LENGTH = 2000; // matches Comment.body @db.VarChar(2000) in schema.prisma

// Exported so other namespaces (e.g. the Staff comment endpoint, #39 Task 24) can reuse the
// exact same select shape/serialization instead of drifting from it.
export const COMMENT_SELECT = {
  id: true,
  ticketId: true,
  body: true,
  createdAt: true,
  author: { select: { id: true, displayName: true, role: true } },
} as const;

export function serializeComment(comment: {
  id: string; ticketId: string; body: string; createdAt: Date;
  author: { id: string; displayName: string; role: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR' };
}) {
  return {
    id: comment.id,
    ticketId: comment.ticketId,
    body: comment.body,
    author: { id: comment.author.id, displayName: comment.author.displayName },
    authorRole: comment.author.role,
    createdAt: comment.createdAt,
  };
}

async function findOwnedTicket(ticketId: string, requesterId: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket || ticket.requesterId !== requesterId) {
    // Identical 404 for "doesn't exist" and "exists but isn't yours" -- D-24, api-spec.md #14/#15.
    throw new HttpError(404, 'TICKET_NOT_ACCESSIBLE', 'Ticket not found');
  }
  return ticket;
}

ticketCommentsRouter.get<{ id: string }>('/', async (req, res, next) => {
  try {
    const ticket = await findOwnedTicket(req.params.id, req.user!.id);
    const comments = await prisma.comment.findMany({
      where: { ticketId: ticket.id },
      select: COMMENT_SELECT,
      orderBy: { createdAt: 'asc' },
    });
    res.status(200).json(comments.map(serializeComment));
  } catch (error) {
    next(error);
  }
});

ticketCommentsRouter.post<{ id: string }>('/', async (req, res, next) => {
  try {
    const ticket = await findOwnedTicket(req.params.id, req.user!.id);

    const validated = validateCreateCommentRequest(req.body ?? {});
    if (!validated.ok) throw new ValidationHttpError(validated.errors);
    const { body, problemAppearsResolved } = validated.value;

    const storedBody = problemAppearsResolved ? `${PROBLEM_RESOLVED_PREFIX}${body}` : body;
    if (storedBody.length > MAX_STORED_BODY_LENGTH) {
      // The prefix (46 chars) can push an already-valid 2000-char body over the column limit --
      // caught here as a normal 422, not a raw Postgres error, since the validator alone can't
      // know about problemAppearsResolved's effect on the final stored length.
      throw new ValidationHttpError([
        {
          field: 'body',
          message: `body must be at most ${MAX_STORED_BODY_LENGTH - PROBLEM_RESOLVED_PREFIX.length} characters when problemAppearsResolved is set`,
        },
      ]);
    }

    const created = await prisma.$transaction(async (tx) => {
      const comment = await tx.comment.create({
        data: { ticketId: ticket.id, authorId: req.user!.id, body: storedBody },
        select: COMMENT_SELECT,
      });
      await tx.ticketEvent.create({
        data: { ticketId: ticket.id, actorId: req.user!.id, eventType: 'COMMENT_ADDED' },
      });
      return comment;
    });

    res.status(201).json(serializeComment(created));
  } catch (error) {
    next(error);
  }
});
