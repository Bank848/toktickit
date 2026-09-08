import { Router, Request } from 'express';
import { prisma } from '../../../prisma';
import { findTicketOrThrow } from './shared';

export const staffAttachmentsRouter = Router({ mergeParams: true }); // mounted at /staff/tickets/:id/attachments

const ATTACHMENT_SELECT = {
  id: true, originalFilename: true, mimeType: true, sizeBytes: true, createdAt: true,
  deletedAt: true, deletedReason: true,
  uploadedBy: { select: { id: true, displayName: true } },
  deletedBy: { select: { id: true, displayName: true } },
} as const;

function absoluteDownloadUrl(req: Request, attachmentId: string): string {
  return `${req.protocol}://${req.get('host')}/api/v1/attachments/${attachmentId}/content`;
}

function serializeAttachment(req: Request, attachment: {
  id: string; originalFilename: string; mimeType: string; sizeBytes: number; createdAt: Date;
  uploadedBy: { id: string; displayName: string };
  deletedAt: Date | null; deletedReason: string | null;
  deletedBy: { id: string; displayName: string } | null;
}) {
  const removed = attachment.deletedAt !== null;
  return {
    id: attachment.id, originalFilename: attachment.originalFilename, mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes, createdAt: attachment.createdAt, uploadedBy: attachment.uploadedBy,
    status: removed ? 'REMOVED' : 'ACTIVE',
    downloadUrl: removed ? null : absoluteDownloadUrl(req, attachment.id),
    removal: removed ? { reason: attachment.deletedReason, removedAt: attachment.deletedAt, removedBy: attachment.deletedBy } : null,
  };
}

staffAttachmentsRouter.get<{ id: string }>('/', async (req, res, next) => {
  try {
    const ticket = await findTicketOrThrow(req.params.id);
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
// No POST/DELETE route in this router by design -- A-10, IT Staff cannot upload or remove
// Attachments in Lab 3; the Staff Ticket Detail screen shows this list download-only.
