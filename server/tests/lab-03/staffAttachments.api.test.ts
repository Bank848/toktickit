import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma';
import { truncateTicketTables } from '../helpers/resetDb';
import { loginAs } from '../helpers/auth';
import { SEED_EMAILS } from '../helpers/staffFixtures';
import { generateTicketNumber } from '../../src/services/ticketNumber';

describe('GET /api/v1/staff/tickets/:id/attachments', () => {
  let staffCookie: string;
  let requesterId: string;
  let categoryId: number;

  beforeAll(async () => {
    staffCookie = await loginAs(SEED_EMAILS.itStaff1);
    requesterId = (await prisma.user.findUniqueOrThrow({ where: { email: SEED_EMAILS.requester } })).id;
    categoryId = (await prisma.category.findFirstOrThrow({ where: { isActive: true } })).id;
  });

  beforeEach(async () => {
    await truncateTicketTables();
  });

  async function createTicketWithAttachment() {
    const ticketNo = await generateTicketNumber(prisma, new Date().getUTCFullYear());
    const ticket = await prisma.ticket.create({
      data: {
        ticketNo, summary: 'VPN down', description: 'Cannot connect to VPN from home.',
        requestedPriority: 'MEDIUM', itPriority: 'MEDIUM', requesterId, categoryId,
      },
    });
    await prisma.attachment.create({
      data: {
        ticketId: ticket.id, uploadedById: requesterId, originalFilename: 'log.txt',
        mimeType: 'text/plain', sizeBytes: 12, storageKey: `test-key-${ticket.id}`,
      },
    });
    return ticket;
  }

  it('returns existing attachments for any ticket, read-only shape', async () => {
    const ticket = await createTicketWithAttachment();
    const response = await request(app).get(`/api/v1/staff/tickets/${ticket.id}/attachments`).set('Cookie', staffCookie);
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].originalFilename).toBe('log.txt');
  });

  it('has no corresponding POST route (IT Staff cannot upload, A-10)', async () => {
    const ticket = await createTicketWithAttachment();
    const response = await request(app).post(`/api/v1/staff/tickets/${ticket.id}/attachments`).set('Cookie', staffCookie);
    expect(response.status).toBe(404);
  });

  it('returns 404 for a nonexistent ticket id', async () => {
    const response = await request(app)
      .get('/api/v1/staff/tickets/00000000-0000-0000-0000-000000000000/attachments')
      .set('Cookie', staffCookie);
    expect(response.status).toBe(404);
  });
});
