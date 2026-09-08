import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma';
import { truncateTicketTables } from '../helpers/resetDb';
import { loginAs } from '../helpers/auth';
import { SEED_EMAILS } from '../helpers/staffFixtures';
import { generateTicketNumber } from '../../src/services/ticketNumber';

describe('PATCH /api/v1/staff/tickets/:id/status', () => {
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

  async function createTicket(status: string) {
    const ticketNo = await generateTicketNumber(prisma, new Date().getUTCFullYear());
    return prisma.ticket.create({
      data: {
        ticketNo, summary: 'VPN down', description: 'Cannot connect to VPN from home.',
        requestedPriority: 'MEDIUM', itPriority: 'MEDIUM', requesterId, categoryId,
        status: status as never,
      },
    });
  }

  async function patchStatus(id: string, status: string) {
    return request(app).patch(`/api/v1/staff/tickets/${id}/status`).set('Cookie', staffCookie).send({ status });
  }

  // Table-driven test covering all 13 direct rows of specification.md §4.4 (row 1, NEW->OPEN,
  // is intentionally excluded here -- it is never a direct status-endpoint transition, see the
  // dedicated rejection test below and Task 5's AC-18 cross-check test).
  const VALID_DIRECT_TRANSITIONS: Array<[string, string]> = [
    ['NEW', 'CANCELLED'],
    ['OPEN', 'IN_PROGRESS'],
    ['OPEN', 'WAITING_FOR_REQUESTER'],
    ['OPEN', 'CANCELLED'],
    ['IN_PROGRESS', 'WAITING_FOR_REQUESTER'],
    ['IN_PROGRESS', 'RESOLVED'],
    ['WAITING_FOR_REQUESTER', 'IN_PROGRESS'],
    ['WAITING_FOR_REQUESTER', 'RESOLVED'],
    ['WAITING_FOR_REQUESTER', 'CANCELLED'],
    ['RESOLVED', 'CLOSED'],
    ['RESOLVED', 'REOPENED'],
    ['CLOSED', 'REOPENED'],
    ['REOPENED', 'OPEN'],
  ];

  it.each(VALID_DIRECT_TRANSITIONS)('allows %s -> %s (AC-19)', async (from, to) => {
    const ticket = await createTicket(from);
    const response = await patchStatus(ticket.id, to);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe(to);
  });

  it('rejects NEW -> OPEN as a direct status change (row 1 is automatic-only, AC-18)', async () => {
    const ticket = await createTicket('NEW');
    const response = await patchStatus(ticket.id, 'OPEN');
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('rejects an out-of-matrix transition, e.g. NEW -> RESOLVED, with 409 and leaves status unchanged', async () => {
    const ticket = await createTicket('NEW');
    const response = await patchStatus(ticket.id, 'RESOLVED');
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    const reloaded = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(reloaded.status).toBe('NEW');
  });

  it('rejects any transition out of CANCELLED with 409 TICKET_LOCKED, not INVALID_STATUS_TRANSITION (terminal, AC-19/AC-20)', async () => {
    const ticket = await createTicket('CANCELLED');
    const response = await patchStatus(ticket.id, 'OPEN');
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('TICKET_LOCKED');
  });

  it('rejects CLOSED -> anything except REOPENED with 409 TICKET_LOCKED, not INVALID_STATUS_TRANSITION (AC-20)', async () => {
    const ticket = await createTicket('CLOSED');
    const response = await patchStatus(ticket.id, 'IN_PROGRESS');
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('TICKET_LOCKED');
  });

  it('rejects REOPENED -> anything except OPEN', async () => {
    const ticket = await createTicket('REOPENED');
    const response = await patchStatus(ticket.id, 'RESOLVED');
    expect(response.status).toBe(409);
  });

  it('rejects an attempt to set status: NEW explicitly (never a valid target, AC-21 sibling rule)', async () => {
    const ticket = await createTicket('OPEN');
    const response = await patchStatus(ticket.id, 'NEW');
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('accepts REOPENED only from RESOLVED or CLOSED, rejects it from IN_PROGRESS (AC-21)', async () => {
    const ticket = await createTicket('IN_PROGRESS');
    const response = await patchStatus(ticket.id, 'REOPENED');
    expect(response.status).toBe(409);
  });

  it('rejects an unrecognized status string with 422', async () => {
    const ticket = await createTicket('NEW');
    const response = await patchStatus(ticket.id, 'ON_HOLD');
    expect(response.status).toBe(422);
  });

  it('returns 404 for a nonexistent ticket id', async () => {
    const response = await patchStatus('00000000-0000-0000-0000-000000000000', 'OPEN');
    expect(response.status).toBe(404);
  });
});
