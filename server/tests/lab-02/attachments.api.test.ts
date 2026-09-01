import { describe, it, expect, beforeAll, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma';
import { attachmentStorage } from '../../src/lib/attachmentStorage';
import { truncateTicketTables } from '../helpers/resetDb';

const PNG_BYTES = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32),
]);
const PDF_BYTES = Buffer.concat([Buffer.from('%PDF-1.4', 'ascii'), Buffer.alloc(32)]);
const OVERSIZED_PDF_BYTES = Buffer.concat([Buffer.from('%PDF-1.4', 'ascii'), Buffer.alloc(5 * 1024 * 1024 + 1)]);

describe('Attachments API', () => {
  let requesterId: string;
  let categoryId: number;

  beforeAll(async () => {
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: 'requester@toktickit.local' } });
    requesterId = requester.id;
  });

  beforeEach(async () => {
    await truncateTicketTables();
    const category = await prisma.category.findFirstOrThrow({ where: { isActive: true } });
    categoryId = category.id;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function createTicket(overrides: Partial<{ requesterId: string; status: string }> = {}) {
    return prisma.ticket.create({
      data: {
        ticketNo: `TKT-2026-${Math.floor(Math.random() * 90000 + 10000)}`,
        summary: 'Test ticket for attachments',
        description: 'A ticket created directly via Prisma for attachment lifecycle tests.',
        requestedPriority: 'LOW',
        itPriority: 'LOW',
        requesterId: overrides.requesterId ?? requesterId,
        categoryId,
        status: (overrides.status as never) ?? undefined,
      },
    });
  }

  async function createAttachment(
    ticketId: string,
    uploadedById: string,
    overrides: Partial<{ deletedAt: Date | null }> = {}
  ) {
    const storageKey = await attachmentStorage.save(Buffer.from('stub content'));
    return prisma.attachment.create({
      data: {
        ticketId,
        uploadedById,
        originalFilename: 'stub.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 12,
        storageKey,
        deletedAt: overrides.deletedAt ?? null,
      },
    });
  }

  describe('POST /api/v1/tickets/:id/attachments', () => {
    it('returns 401 without identity', async () => {
      const ticket = await createTicket();
      const response = await request(app)
        .post(`/api/v1/tickets/${ticket.id}/attachments`)
        .attach('file', PDF_BYTES, { filename: 'doc.pdf', contentType: 'application/pdf' });
      expect(response.status).toBe(401);
    });

    it('returns 404 for a nonexistent ticket', async () => {
      const response = await request(app)
        .post(`/api/v1/tickets/${randomUUID()}/attachments`)
        .set('x-dev-user-id', requesterId)
        .attach('file', PDF_BYTES, { filename: 'doc.pdf', contentType: 'application/pdf' });
      expect(response.status).toBe(404);
    });

    it('returns 404 for another requester\'s ticket', async () => {
      const other = await prisma.user.findUniqueOrThrow({ where: { email: 'requester2@toktickit.local' } });
      const ticket = await createTicket({ requesterId: other.id });
      const response = await request(app)
        .post(`/api/v1/tickets/${ticket.id}/attachments`)
        .set('x-dev-user-id', requesterId)
        .attach('file', PDF_BYTES, { filename: 'doc.pdf', contentType: 'application/pdf' });
      expect(response.status).toBe(404);
    });

    it('still returns 404 (not a multer parse error) for a nonexistent ticket even with a malformed multipart body -- proves ordering', async () => {
      // A deliberately-corrupt multipart body (not a genuinely 5MB+ upload -- see the dedicated
      // 413 test below for that) is enough to prove authorizeAndCheckLimit runs before multer:
      // if multer ran first against this body it would throw a parse error, not resolve into the
      // 404 that ticket-ownership checking produces.
      const response = await request(app)
        .post(`/api/v1/tickets/${randomUUID()}/attachments`)
        .set('x-dev-user-id', requesterId)
        .set('Content-Type', 'multipart/form-data; boundary=----malformedBoundary')
        .send('this is not a valid multipart body');
      expect(response.status).toBe(404);
    });

    it('returns 409 ATTACHMENT_LIMIT_REACHED once 5 active attachments already exist', async () => {
      const ticket = await createTicket();
      for (let i = 0; i < 5; i++) {
        await createAttachment(ticket.id, requesterId);
      }
      const response = await request(app)
        .post(`/api/v1/tickets/${ticket.id}/attachments`)
        .set('x-dev-user-id', requesterId)
        .attach('file', PDF_BYTES, { filename: 'doc.pdf', contentType: 'application/pdf' });
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('ATTACHMENT_LIMIT_REACHED');
    });

    it('does not count removed attachments toward the 5-attachment limit', async () => {
      const ticket = await createTicket();
      for (let i = 0; i < 4; i++) {
        await createAttachment(ticket.id, requesterId);
      }
      await createAttachment(ticket.id, requesterId, { deletedAt: new Date() });

      const response = await request(app)
        .post(`/api/v1/tickets/${ticket.id}/attachments`)
        .set('x-dev-user-id', requesterId)
        .attach('file', PDF_BYTES, { filename: 'doc.pdf', contentType: 'application/pdf' });
      expect(response.status).toBe(201);
    });

    it('returns 413 ATTACHMENT_TOO_LARGE via mapMulterError for a body over 5 MB on a valid ticket', async () => {
      const ticket = await createTicket();
      const response = await request(app)
        .post(`/api/v1/tickets/${ticket.id}/attachments`)
        .set('x-dev-user-id', requesterId)
        .attach('file', OVERSIZED_PDF_BYTES, { filename: 'big.pdf', contentType: 'application/pdf' });
      expect(response.status).toBe(413);
      expect(response.body.error.code).toBe('ATTACHMENT_TOO_LARGE');
    });

    it('returns 422 ATTACHMENT_TYPE_REJECTED for a disallowed file type', async () => {
      const ticket = await createTicket();
      const response = await request(app)
        .post(`/api/v1/tickets/${ticket.id}/attachments`)
        .set('x-dev-user-id', requesterId)
        .attach('file', Buffer.from('MZ executable stub'), { filename: 'virus.exe', contentType: 'application/octet-stream' });
      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('ATTACHMENT_TYPE_REJECTED');
    });

    it('returns 201 with an absolute downloadUrl and never leaks storageKey on the happy path', async () => {
      const ticket = await createTicket();
      const response = await request(app)
        .post(`/api/v1/tickets/${ticket.id}/attachments`)
        .set('x-dev-user-id', requesterId)
        .attach('file', PDF_BYTES, { filename: 'doc.pdf', contentType: 'application/pdf' });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('ACTIVE');
      expect(response.body.downloadUrl).toMatch(
        new RegExp(`^http://127\\.0\\.0\\.1(:\\d+)?/api/v1/attachments/${response.body.id}/content$`)
      );
      expect(JSON.stringify(response.body)).not.toContain('storageKey');

      const event = await prisma.ticketEvent.findFirst({ where: { ticketId: ticket.id, eventType: 'ATTACHMENT_ADDED' } });
      expect(event).not.toBeNull();
    });

    it('cleans up the just-written storage object if the metadata insert fails', async () => {
      const ticket = await createTicket();
      // $transaction, not attachment.create, is mocked -- the callback runs against a separate
      // `tx` proxy Prisma creates per-transaction, so spying on the top-level `prisma.attachment
      // .create` would never intercept it. Rejecting $transaction itself is the black-box way to
      // simulate "the metadata insert failed", matching what the plan calls a bad-ticketId race.
      vi.spyOn(prisma, '$transaction').mockRejectedValueOnce(new Error('simulated FK race'));
      const removeSpy = vi.spyOn(attachmentStorage, 'remove');

      const response = await request(app)
        .post(`/api/v1/tickets/${ticket.id}/attachments`)
        .set('x-dev-user-id', requesterId)
        .attach('file', PDF_BYTES, { filename: 'doc.pdf', contentType: 'application/pdf' });

      expect(response.status).toBe(500);
      expect(removeSpy).toHaveBeenCalledTimes(1);
      const attachmentCount = await prisma.attachment.count({ where: { ticketId: ticket.id } });
      expect(attachmentCount).toBe(0);
    });
  });

  describe('GET /api/v1/attachments/:id/content', () => {
    it('returns 200 with correct headers and the stored bytes for an active attachment', async () => {
      const ticket = await createTicket();
      const storageKey = await attachmentStorage.save(Buffer.from('the actual file bytes'));
      const attachment = await prisma.attachment.create({
        data: {
          ticketId: ticket.id,
          uploadedById: requesterId,
          originalFilename: 'notes.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 22,
          storageKey,
        },
      });

      const response = await request(app)
        .get(`/api/v1/attachments/${attachment.id}/content`)
        .set('x-dev-user-id', requesterId)
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.headers['content-disposition']).toContain('notes.pdf');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect((response.body as Buffer).toString()).toBe('the actual file bytes');
    });

    it('returns 410 for a removed attachment', async () => {
      const ticket = await createTicket();
      const attachment = await createAttachment(ticket.id, requesterId, { deletedAt: new Date() });

      const response = await request(app)
        .get(`/api/v1/attachments/${attachment.id}/content`)
        .set('x-dev-user-id', requesterId);
      expect(response.status).toBe(410);
    });

    it('returns 404 for an attachment on someone else\'s ticket', async () => {
      const other = await prisma.user.findUniqueOrThrow({ where: { email: 'requester2@toktickit.local' } });
      const ticket = await createTicket({ requesterId: other.id });
      const attachment = await createAttachment(ticket.id, other.id);

      const response = await request(app)
        .get(`/api/v1/attachments/${attachment.id}/content`)
        .set('x-dev-user-id', requesterId);
      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/attachments/:id', () => {
    it('returns 404 for a nonexistent attachment even with a malformed reason, before validating reason', async () => {
      const response = await request(app)
        .delete(`/api/v1/attachments/${randomUUID()}`)
        .set('x-dev-user-id', requesterId)
        .send({ reason: '' });
      expect(response.status).toBe(404);
    });

    it('returns 422 for a missing/empty reason on an otherwise-valid removal', async () => {
      const ticket = await createTicket();
      const attachment = await createAttachment(ticket.id, requesterId);

      const response = await request(app)
        .delete(`/api/v1/attachments/${attachment.id}`)
        .set('x-dev-user-id', requesterId)
        .send({});
      expect(response.status).toBe(422);
    });

    it('returns 403 when the caller owns the ticket but did not upload the attachment (distinct from the 404)', async () => {
      const other = await prisma.user.findUniqueOrThrow({ where: { email: 'requester2@toktickit.local' } });
      const ticket = await createTicket({ requesterId });
      // Simulates a state the API itself cannot currently produce (only the ticket's own
      // requester can upload), but the plan requires this ordering to be provably distinct
      // from the 404 case -- inserted directly via Prisma.
      const attachment = await createAttachment(ticket.id, other.id);

      const response = await request(app)
        .delete(`/api/v1/attachments/${attachment.id}`)
        .set('x-dev-user-id', requesterId)
        .send({ reason: 'Not mine to remove' });
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('ATTACHMENT_NOT_OWNED');
    });

    it('returns 409 when the ticket is CLOSED', async () => {
      const ticket = await createTicket({ status: 'CLOSED' });
      const attachment = await createAttachment(ticket.id, requesterId);

      const response = await request(app)
        .delete(`/api/v1/attachments/${attachment.id}`)
        .set('x-dev-user-id', requesterId)
        .send({ reason: 'Uploaded by mistake' });
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('TICKET_CLOSED');
    });

    it('returns 200 with status REMOVED and removal fields on the happy path, and a follow-up download 410s', async () => {
      const ticket = await createTicket();
      const attachment = await createAttachment(ticket.id, requesterId);

      const response = await request(app)
        .delete(`/api/v1/attachments/${attachment.id}`)
        .set('x-dev-user-id', requesterId)
        .send({ reason: 'Uploaded the wrong file' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('REMOVED');
      expect(response.body.removal.reason).toBe('Uploaded the wrong file');
      expect(response.body.removal.removedAt).toBeTruthy();
      expect(response.body.removal.removedBy.id).toBe(requesterId);
      expect(response.body.downloadUrl).toBeNull();

      const event = await prisma.ticketEvent.findFirst({ where: { ticketId: ticket.id, eventType: 'ATTACHMENT_REMOVED' } });
      expect(event).not.toBeNull();

      const followUp = await request(app)
        .get(`/api/v1/attachments/${attachment.id}/content`)
        .set('x-dev-user-id', requesterId);
      expect(followUp.status).toBe(410);
    });
  });
});
