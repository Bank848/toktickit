import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../../prisma';
import { attachmentStorage } from '../../lib/attachmentStorage';
import { isAllowedAttachment } from '../../validators/attachmentValidation';
import { HttpError, ValidationHttpError } from '../../middleware/errorEnvelope';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export const ticketAttachmentsRouter = Router({ mergeParams: true }); // mounted at /tickets/:id/attachments
export const attachmentContentRouter = Router(); // mounted at /attachments/:id

function absoluteDownloadUrl(req: import('express').Request, attachmentId: string): string {
  // Fixes the real bug api-spec.md documents: a root-relative downloadUrl resolves against the
  // Vite dev origin, not the API. Compose it server-side from the request's own host so no new
  // env var is needed and it's correct in every environment without configuration.
  return `${req.protocol}://${req.get('host')}/api/v1/attachments/${attachmentId}/content`;
}

function serializeAttachment(req: import('express').Request, attachment: {
  id: string; originalFilename: string; mimeType: string; sizeBytes: number; createdAt: Date;
  uploadedBy: { id: string; displayName: string };
  deletedAt: Date | null; deletedReason: string | null;
  deletedBy: { id: string; displayName: string } | null;
}) {
  const removed = attachment.deletedAt !== null;
  return {
    id: attachment.id,
    originalFilename: attachment.originalFilename,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    createdAt: attachment.createdAt,
    uploadedBy: attachment.uploadedBy,
    status: removed ? 'REMOVED' : 'ACTIVE',
    downloadUrl: removed ? null : absoluteDownloadUrl(req, attachment.id),
    removal: removed
      ? { reason: attachment.deletedReason, removedAt: attachment.deletedAt, removedBy: attachment.deletedBy }
      : null,
  };
  // storageKey is never selected into this shape -- see the Prisma `select` below, which omits
  // it at the query level too, so there is no code path where it could leak.
}

const ATTACHMENT_SELECT = {
  id: true, originalFilename: true, mimeType: true, sizeBytes: true, createdAt: true,
  deletedAt: true, deletedReason: true,
  uploadedBy: { select: { id: true, displayName: true } },
  deletedBy: { select: { id: true, displayName: true } },
} as const;

async function findOwnedTicket(ticketId: string, requesterId: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket || ticket.requesterId !== requesterId) {
    // Identical 404 for "doesn't exist" and "exists but isn't yours" -- D-24, api-spec.md #8.
    throw new HttpError(404, 'TICKET_NOT_ACCESSIBLE', 'Ticket not found');
  }
  return ticket;
}

// Router({ mergeParams: true }) makes `:id` available on req.params at runtime (it's mounted at
// `/tickets/:id/attachments`), but TypeScript can't infer that from this router's own route
// string ('/' has no `:id` segment of its own) -- the explicit generic below is a type-only
// deviation from the plan's untyped destructure, needed to satisfy `tsc --noEmit`.
ticketAttachmentsRouter.get<{ id: string }>('/', async (req, res, next) => {
  try {
    const ticket = await findOwnedTicket(req.params.id, req.user!.id);
    const attachments = await prisma.attachment.findMany({
      where: { ticketId: ticket.id },
      select: ATTACHMENT_SELECT,
      orderBy: { createdAt: 'asc' },
    });
    res.status(200).json(attachments.map((a) => serializeAttachment(req, a)));
  } catch (error) {
    next(error);
  }
});

// Review fix: ticket-exists/ownership (404) and the active-count limit (409) must be checked
// BEFORE multer ever reads the request body -- api-spec.md's #10 order is
// ticket accessible -> count<5 -> size -> type. Running them as router middleware ahead of
// `upload.single('file')` means an oversized or malformed body against a nonexistent/foreign
// ticket still correctly returns 404, not a Multer error the size middleware would throw first.
async function authorizeAndCheckLimit(req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) {
  try {
    const ticket = await findOwnedTicket(req.params.id, req.user!.id);
    const activeCount = await prisma.attachment.count({ where: { ticketId: ticket.id, deletedAt: null } });
    if (activeCount >= 5) {
      throw new HttpError(409, 'ATTACHMENT_LIMIT_REACHED', 'This ticket already has 5 active attachments');
    }
    (req as unknown as { ticket: typeof ticket }).ticket = ticket;
    next();
  } catch (error) {
    next(error);
  }
}

// Review fix: multer's own 5 MB limit throws a `MulterError`, which errorEnvelope.ts does NOT
// special-case (it only handles `HttpError`), so an oversized upload would otherwise fall through
// to a generic 500 instead of the spec-mandated 413. This middleware runs immediately after
// `upload.single('file')` and translates that one error code before anything else sees it.
function mapMulterError(err: unknown, _req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    next(new HttpError(413, 'ATTACHMENT_TOO_LARGE', 'File exceeds the 5 MB limit'));
    return;
  }
  next(err);
}

ticketAttachmentsRouter.post<{ id: string }>(
  '/',
  authorizeAndCheckLimit,
  upload.single('file'),
  mapMulterError,
  // Explicit param types here too -- with a mixed error-handling/regular middleware array,
  // TypeScript's overload resolution for router.post falls back to implicit `any` on this last
  // handler's (req, res, next) without them.
  async (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
  try {
    const ticket = (req as unknown as { ticket: { id: string } }).ticket;

    const file = req.file;
    if (!file) throw new ValidationHttpError([{ field: 'file', message: 'file is required' }]);

    const allowed = await isAllowedAttachment(file.originalname, file.mimetype, file.buffer);
    if (!allowed) {
      throw new HttpError(422, 'ATTACHMENT_TYPE_REJECTED', 'File type not allowed');
    }

    const storageKey = await attachmentStorage.save(file.buffer);
    try {
      const created = await prisma.$transaction(async (tx) => {
        const attachment = await tx.attachment.create({
          data: {
            ticketId: ticket.id,
            uploadedById: req.user!.id,
            originalFilename: file.originalname,
            mimeType: file.mimetype,
            sizeBytes: file.size,
            storageKey,
          },
          select: ATTACHMENT_SELECT,
        });
        await tx.ticketEvent.create({
          data: { ticketId: ticket.id, actorId: req.user!.id, eventType: 'ATTACHMENT_ADDED' },
        });
        return attachment;
      });
      res.status(201).json(serializeAttachment(req, created));
    } catch (transactionError) {
      // Compensating cleanup, per SDS -- the metadata insert failed after the object was
      // already written to storage, so remove it rather than leaving an orphaned file.
      await attachmentStorage.remove(storageKey);
      throw transactionError;
    }
  } catch (error) {
    next(error);
  }
});

attachmentContentRouter.get('/:id/content', async (req, res, next) => {
  try {
    const attachment = await prisma.attachment.findUnique({
      where: { id: req.params.id },
      include: { ticket: true },
    });
    if (!attachment || attachment.ticket.requesterId !== req.user!.id) {
      throw new HttpError(404, 'TICKET_NOT_ACCESSIBLE', 'Ticket not found');
    }
    if (attachment.deletedAt) {
      throw new HttpError(410, 'ATTACHMENT_REMOVED', 'This attachment has been removed');
    }
    const bytes = await attachmentStorage.read(attachment.storageKey);
    const safeName = attachment.originalFilename.replace(/[\r\n"]/g, '');
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.status(200).send(bytes);
  } catch (error) {
    next(error);
  }
});

attachmentContentRouter.delete('/:id', async (req, res, next) => {
  try {
    // Review fix: feature-f.md orders removal validation as authorize (uploader-only) -> ticket
    // not Closed -> reason present (422), reason LAST. Checking reason first would return 422 for
    // a malformed body against a nonexistent attachment, leaking "this attachment exists" via a
    // different status code than the 404 a genuinely-missing one gets -- exactly the kind of
    // existence leak D-24 exists to prevent. Load and authorize first, validate reason last.
    const attachment = await prisma.attachment.findUnique({
      where: { id: req.params.id },
      include: { ticket: true },
    });
    if (!attachment || attachment.ticket.requesterId !== req.user!.id) {
      throw new HttpError(404, 'TICKET_NOT_ACCESSIBLE', 'Ticket not found');
    }
    if (attachment.uploadedById !== req.user!.id) {
      // Different from the 404 above: the caller can already see this ticket/attachment, so
      // there's nothing left to hide -- 403 correctly signals "yours to view, not yours to remove".
      throw new HttpError(403, 'ATTACHMENT_NOT_OWNED', 'Only the uploader can remove this attachment');
    }
    if (attachment.ticket.status === 'CLOSED') {
      throw new HttpError(409, 'TICKET_CLOSED', 'Cannot modify attachments on a closed ticket');
    }

    const { reason } = req.body ?? {};
    const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
    if (trimmedReason.length < 1 || trimmedReason.length > 200) {
      throw new ValidationHttpError([{ field: 'reason', message: 'reason is required, 1-200 characters' }]);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.attachment.update({
        where: { id: attachment.id },
        data: { deletedAt: new Date(), deletedById: req.user!.id, deletedReason: trimmedReason },
        select: ATTACHMENT_SELECT,
      });
      await tx.ticketEvent.create({
        data: { ticketId: attachment.ticketId, actorId: req.user!.id, eventType: 'ATTACHMENT_REMOVED' },
      });
      return result;
    });

    try {
      await attachmentStorage.remove(attachment.storageKey);
    } catch (storageError) {
      // Never fail the request over a storage cleanup error -- the row is already correctly
      // marked removed, which is what makes the attachment inaccessible. Log with the
      // correlation id and leave the orphaned object for a later retry job.
      console.error(`Failed to delete storage object for attachment ${attachment.id}`, storageError);
    }

    res.status(200).json(serializeAttachment(req, updated));
  } catch (error) {
    next(error);
  }
});
