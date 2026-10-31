import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma';

// PATCH .../status requires If-Match (api-spec 4.4). By default this sends the Ticket's current
// etag, read from the database just before the request, so a test only passes an explicit value
// when it is exercising a missing or stale header (pass null to omit the header).
export async function patchStatus(
  cookie: string, ticketId: string, status: string, ifMatch?: string | null,
): Promise<request.Response> {
  let header = ifMatch;
  if (header === undefined) {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { updatedAt: true } });
    header = `"${(ticket?.updatedAt ?? new Date(0)).toISOString()}"`;
  }
  const req = request(app).patch(`/api/v1/staff/tickets/${ticketId}/status`).set('Cookie', cookie);
  if (header !== null) req.set('If-Match', header);
  return req.send({ status });
}
