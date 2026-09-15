import { Router } from 'express';
import { prisma } from '../../../prisma';
import { ValidationHttpError } from '../../../middleware/errorEnvelope';
import { findTicketOrThrow } from './shared';

export const staffNotesRouter = Router({ mergeParams: true }); // mounted at /staff/tickets/:id/notes

function serializeNote(note: { id: string; ticketId: string; body: string; createdAt: Date; author: { id: string; displayName: string } }) {
  return { id: note.id, ticketId: note.ticketId, body: note.body, author: note.author, createdAt: note.createdAt };
}

staffNotesRouter.get<{ id: string }>('/', async (req, res, next) => {
  try {
    const ticket = await findTicketOrThrow(req.params.id);
    const notes = await prisma.internalNote.findMany({
      where: { ticketId: ticket.id },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { id: true, displayName: true, role: true } } },
    });
    res.status(200).json(notes.map(serializeNote));
  } catch (error) {
    next(error);
  }
});

staffNotesRouter.post<{ id: string }>('/', async (req, res, next) => {
  try {
    const { body } = req.body ?? {};
    const trimmed = typeof body === 'string' ? body.trim() : '';
    if (trimmed.length < 1 || trimmed.length > 2000) {
      throw new ValidationHttpError([{ field: 'body', message: 'body is required, 1-2000 characters' }]);
    }

    const ticket = await findTicketOrThrow(req.params.id);
    const created = await prisma.internalNote.create({
      data: { ticketId: ticket.id, authorId: req.user!.id, body: trimmed },
      include: { author: { select: { id: true, displayName: true, role: true } } },
    });
    res.status(201).json(serializeNote(created));
  } catch (error) {
    next(error);
  }
});
