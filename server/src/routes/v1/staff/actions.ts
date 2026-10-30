import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../prisma';
import { HttpError, ValidationHttpError } from '../../../middleware/errorEnvelope';
import {
  validateCreateActionTakenRequest, validateUpdateActionTakenRequest, ValidatedActionTakenRequest,
} from '../../../validators/actionTakenRequest';
import { ACTION_INCLUDE, ACTION_ORDER, serializeAction, actionEtag } from '../../../services/actionTaken';
import { findTicketOrThrow } from './shared';

export const staffActionsRouter = Router({ mergeParams: true }); // mounted at /staff/tickets/:id/actions

const TERMINAL_STATUSES = ['CLOSED', 'CANCELLED'] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type StoredAction = Prisma.ActionTakenGetPayload<{ include: typeof ACTION_INCLUDE }>;

function requireIdempotencyKey(req: Request): string {
  const raw = req.header('Idempotency-Key');
  if (!raw || !UUID_RE.test(raw.trim())) {
    throw new HttpError(428, 'PRECONDITION_REQUIRED', 'A UUID Idempotency-Key header is required');
  }
  return raw.trim().toLowerCase();
}

function requireIfMatch(req: Request): string {
  const raw = req.header('If-Match');
  if (!raw || raw.trim() === '') {
    throw new HttpError(428, 'PRECONDITION_REQUIRED', 'An If-Match header is required');
  }
  return raw.trim();
}

function sameContent(stored: StoredAction, v: ValidatedActionTakenRequest): boolean {
  return (
    stored.actionAt.getTime() === v.actionAt.getTime() &&
    stored.description === v.description &&
    stored.result === v.result &&
    stored.followUpRequired === v.followUpRequired &&
    stored.followUpNote === v.followUpNote &&
    stored.attachmentNotes === v.attachmentNotes
  );
}

function sendOne(res: Response, status: number, action: StoredAction) {
  res.setHeader('ETag', actionEtag(action.updatedAt));
  res.status(status).json(serializeAction(action));
}

function replayOrThrow(res: Response, stored: StoredAction, v: ValidatedActionTakenRequest) {
  if (!sameContent(stored, v)) {
    throw new HttpError(409, 'IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key was already used with a different body');
  }
  res.setHeader('Idempotent-Replayed', 'true');
  sendOne(res, 200, stored);
}

staffActionsRouter.get<{ id: string }>('/', async (req, res, next) => {
  try {
    const ticket = await findTicketOrThrow(req.params.id);
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

staffActionsRouter.post<{ id: string }>('/', async (req, res, next) => {
  try {
    const validated = validateCreateActionTakenRequest(req.body ?? {});
    if (!validated.ok) throw new ValidationHttpError(validated.errors);
    const idempotencyKey = requireIdempotencyKey(req);

    const ticket = await findTicketOrThrow(req.params.id);
    const userId = req.user!.id;
    const keyWhere = { ticketId_performedById_idempotencyKey: { ticketId: ticket.id, performedById: userId, idempotencyKey } };

    // A retry is answered from the stored record even if the Ticket was locked in between.
    const existing = await prisma.actionTaken.findUnique({ where: keyWhere, include: ACTION_INCLUDE });
    if (existing) {
      replayOrThrow(res, existing, validated.value);
      return;
    }

    if (TERMINAL_STATUSES.includes(ticket.status as never)) {
      throw new HttpError(409, 'TICKET_LOCKED', 'Cannot record an Action Taken on a Closed or Cancelled ticket');
    }

    const { actionAt, description, result, followUpRequired, followUpNote, attachmentNotes } = validated.value;
    let created: StoredAction;
    try {
      created = await prisma.$transaction(async (tx) => {
        const action = await tx.actionTaken.create({
          data: {
            ticketId: ticket.id, performedById: userId, actionAt, description, result,
            followUpRequired, followUpNote, attachmentNotes, idempotencyKey,
          },
          include: ACTION_INCLUDE,
        });
        await tx.ticketEvent.create({
          data: { ticketId: ticket.id, actorId: userId, eventType: 'ACTION_TAKEN_ADDED', payload: { actionId: action.id } },
        });
        return action;
      });
    } catch (error) {
      // A concurrent duplicate lost the unique-constraint race: resolve to the stored record.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const winner = await prisma.actionTaken.findUnique({ where: keyWhere, include: ACTION_INCLUDE });
        if (winner) {
          replayOrThrow(res, winner, validated.value);
          return;
        }
      }
      throw error;
    }

    sendOne(res, 201, created);
  } catch (error) {
    next(error);
  }
});

staffActionsRouter.patch<{ id: string; actionId: string }>('/:actionId', async (req, res, next) => {
  try {
    const validated = validateUpdateActionTakenRequest(req.body ?? {});
    if (!validated.ok) throw new ValidationHttpError(validated.errors);
    const ifMatch = requireIfMatch(req);

    const ticket = await findTicketOrThrow(req.params.id);
    if (TERMINAL_STATUSES.includes(ticket.status as never)) {
      throw new HttpError(409, 'TICKET_LOCKED', 'Cannot edit an Action Taken on a Closed or Cancelled ticket');
    }

    const existing = await prisma.actionTaken.findUnique({ where: { id: req.params.actionId } });
    if (!existing || existing.ticketId !== ticket.id) {
      throw new HttpError(404, 'ACTION_NOT_FOUND', 'Action Taken not found');
    }

    const stale = () => new HttpError(409, 'STALE_UPDATE', 'This Action Taken was changed by someone else; reload and try again');
    const expectedUpdatedAt = new Date(ifMatch.replace(/^"(.*)"$/, '$1'));
    if (Number.isNaN(expectedUpdatedAt.getTime())) throw stale();

    const { actionAt, description, result, followUpRequired, followUpNote, attachmentNotes } = validated.value;
    const updated = await prisma.$transaction(async (tx) => {
      // One atomic conditional update: zero rows means the If-Match no longer matches (api-spec 4.4).
      // BR-03: performedById is never part of this write -- only lastEditedById changes.
      const { count } = await tx.actionTaken.updateMany({
        where: { id: existing.id, ticketId: ticket.id, updatedAt: expectedUpdatedAt },
        data: {
          actionAt, description, result, followUpRequired, followUpNote, attachmentNotes,
          lastEditedById: req.user!.id,
        },
      });
      if (count === 0) throw stale();
      await tx.ticketEvent.create({
        data: { ticketId: ticket.id, actorId: req.user!.id, eventType: 'ACTION_TAKEN_UPDATED', payload: { actionId: existing.id } },
      });
      return tx.actionTaken.findUniqueOrThrow({ where: { id: existing.id }, include: ACTION_INCLUDE });
    });

    sendOne(res, 200, updated);
  } catch (error) {
    next(error);
  }
});
