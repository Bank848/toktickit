import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma';
import { truncateTicketTables } from '../helpers/resetDb';
import { loginAs } from '../helpers/auth';
import { SEED_EMAILS } from '../helpers/staffFixtures';
import { generateTicketNumber } from '../../src/services/ticketNumber';

describe('Staff Action Taken routes', () => {
  let staff1Cookie: string;
  let staff2Cookie: string;
  let requesterCookie: string;
  let requesterId: string;
  let staff1Id: string;
  let staff2Id: string;
  let categoryId: number;

  beforeAll(async () => {
    staff1Cookie = await loginAs(SEED_EMAILS.itStaff1);
    staff2Cookie = await loginAs(SEED_EMAILS.itStaff2);
    requesterCookie = await loginAs(SEED_EMAILS.requester);
    requesterId = (await prisma.user.findUniqueOrThrow({ where: { email: SEED_EMAILS.requester } })).id;
    staff1Id = (await prisma.user.findUniqueOrThrow({ where: { email: SEED_EMAILS.itStaff1 } })).id;
    staff2Id = (await prisma.user.findUniqueOrThrow({ where: { email: SEED_EMAILS.itStaff2 } })).id;
    categoryId = (await prisma.category.findFirstOrThrow({ where: { isActive: true } })).id;
  });

  // NOTE: FR-01/FR-02's "Administrator can also create/edit an Action Taken" is exercised in
  // Task 12's test suite, not here -- Administrator access to /staff/* only exists after Task
  // 12 widens staffRouter's role gate, and Task 4/Task 12 run in the same parallel batch, so a
  // test here that logs in as Administrator would be a same-batch ordering hazard.

  beforeEach(async () => {
    await truncateTicketTables();
  });

  async function createTicket(status: string = 'IN_PROGRESS') {
    const ticketNo = await generateTicketNumber(prisma, new Date().getUTCFullYear());
    return prisma.ticket.create({
      data: {
        ticketNo, summary: 'Wifi drops in conference room', description: 'Wifi disconnects every few minutes.',
        status: status as never, requestedPriority: 'MEDIUM', itPriority: 'MEDIUM', requesterId, categoryId,
      },
    });
  }

  const VALID_BODY = {
    actionAt: '2026-09-20T10:00:00.000Z',
    description: 'Rebooted the conference-room access point.',
    result: 'RESOLVED',
    followUpRequired: false,
  };

  it('IT Staff creates an Action Taken; performedBy is the authenticated user (AC-01)', async () => {
    const ticket = await createTicket();
    const response = await request(app)
      .post(`/api/v1/staff/tickets/${ticket.id}/actions`)
      .set('Cookie', staff1Cookie)
      .send(VALID_BODY);
    expect(response.status).toBe(201);
    expect(response.body.performedBy.id).toBe(staff1Id);
    expect(response.body.lastEditedBy).toBeNull();
    expect(response.body.ticketId).toBe(ticket.id);
  });

  it('writes an ACTION_TAKEN_ADDED TicketEvent on create', async () => {
    const ticket = await createTicket();
    await request(app).post(`/api/v1/staff/tickets/${ticket.id}/actions`).set('Cookie', staff1Cookie).send(VALID_BODY);
    const events = await prisma.ticketEvent.findMany({ where: { ticketId: ticket.id, eventType: 'ACTION_TAKEN_ADDED' } });
    expect(events).toHaveLength(1);
  });

  it('does not bump Ticket.updatedAt on create (D-06/BR-14)', async () => {
    const ticket = await createTicket();
    await request(app).post(`/api/v1/staff/tickets/${ticket.id}/actions`).set('Cookie', staff1Cookie).send(VALID_BODY);
    const reloaded = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(reloaded.updatedAt.getTime()).toBe(ticket.updatedAt.getTime());
  });

  it('does not bump Ticket.updatedAt on edit either (D-06/BR-14)', async () => {
    const ticket = await createTicket();
    const created = (
      await request(app).post(`/api/v1/staff/tickets/${ticket.id}/actions`).set('Cookie', staff1Cookie).send(VALID_BODY)
    ).body;
    const ticketAfterCreate = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    await request(app)
      .patch(`/api/v1/staff/tickets/${ticket.id}/actions/${created.id}`)
      .set('Cookie', staff2Cookie)
      .send({ ...VALID_BODY, description: 'Edited description.' });
    const reloaded = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(reloaded.updatedAt.getTime()).toBe(ticketAfterCreate.updatedAt.getTime());
  });

  it('attachmentNotes creates no Attachment row (BR-06 -- it is a free-text field, not a file upload)', async () => {
    const ticket = await createTicket();
    await request(app)
      .post(`/api/v1/staff/tickets/${ticket.id}/actions`)
      .set('Cookie', staff1Cookie)
      .send({ ...VALID_BODY, attachmentNotes: 'Photo shared via email, see attached.' });
    const attachmentCount = await prisma.attachment.count({ where: { ticketId: ticket.id } });
    expect(attachmentCount).toBe(0);
  });

  it('ignores a client-supplied performedById/performedBy and always uses the session user (FR-04)', async () => {
    const ticket = await createTicket();
    const response = await request(app)
      .post(`/api/v1/staff/tickets/${ticket.id}/actions`)
      .set('Cookie', staff1Cookie)
      .send({ ...VALID_BODY, performedById: staff2Id, performedBy: staff2Id });
    expect(response.status).toBe(201);
    expect(response.body.performedBy.id).toBe(staff1Id);
  });

  it('rejects an invalid body with 422 and creates nothing', async () => {
    const ticket = await createTicket();
    const response = await request(app)
      .post(`/api/v1/staff/tickets/${ticket.id}/actions`)
      .set('Cookie', staff1Cookie)
      .send({ ...VALID_BODY, result: 'NOT_A_RESULT' });
    expect(response.status).toBe(422);
    const count = await prisma.actionTaken.count({ where: { ticketId: ticket.id } });
    expect(count).toBe(0);
  });

  it('rejects create against a nonexistent ticket with 404 TICKET_NOT_FOUND', async () => {
    const response = await request(app)
      .post('/api/v1/staff/tickets/00000000-0000-0000-0000-000000000000/actions')
      .set('Cookie', staff1Cookie)
      .send(VALID_BODY);
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('TICKET_NOT_FOUND');
  });

  it('rejects create against a CLOSED ticket with 409 TICKET_LOCKED and creates nothing (BR-08)', async () => {
    const ticket = await createTicket('CLOSED');
    const response = await request(app)
      .post(`/api/v1/staff/tickets/${ticket.id}/actions`)
      .set('Cookie', staff1Cookie)
      .send(VALID_BODY);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('TICKET_LOCKED');
    const count = await prisma.actionTaken.count({ where: { ticketId: ticket.id } });
    expect(count).toBe(0);
  });

  it('rejects create against a CANCELLED ticket with 409 TICKET_LOCKED (BR-08)', async () => {
    const ticket = await createTicket('CANCELLED');
    const response = await request(app)
      .post(`/api/v1/staff/tickets/${ticket.id}/actions`)
      .set('Cookie', staff1Cookie)
      .send(VALID_BODY);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('TICKET_LOCKED');
  });

  it('lets a different IT Staff member edit a record; performedBy stays the original author, lastEditedBy becomes the editor (AC-03/BR-02/BR-03/BR-04)', async () => {
    const ticket = await createTicket();
    const created = (
      await request(app).post(`/api/v1/staff/tickets/${ticket.id}/actions`).set('Cookie', staff1Cookie).send(VALID_BODY)
    ).body;
    const response = await request(app)
      .patch(`/api/v1/staff/tickets/${ticket.id}/actions/${created.id}`)
      .set('Cookie', staff2Cookie)
      .send({ ...VALID_BODY, description: 'Replaced the access point entirely.' });
    expect(response.status).toBe(200);
    expect(response.body.performedBy.id).toBe(staff1Id);
    expect(response.body.lastEditedBy.id).toBe(staff2Id);
    expect(response.body.description).toBe('Replaced the access point entirely.');
  });

  it('writes an ACTION_TAKEN_UPDATED TicketEvent on edit', async () => {
    const ticket = await createTicket();
    const created = (
      await request(app).post(`/api/v1/staff/tickets/${ticket.id}/actions`).set('Cookie', staff1Cookie).send(VALID_BODY)
    ).body;
    await request(app)
      .patch(`/api/v1/staff/tickets/${ticket.id}/actions/${created.id}`)
      .set('Cookie', staff1Cookie)
      .send(VALID_BODY);
    const events = await prisma.ticketEvent.findMany({ where: { ticketId: ticket.id, eventType: 'ACTION_TAKEN_UPDATED' } });
    expect(events).toHaveLength(1);
  });

  it('clears followUpNote to empty when followUpRequired flips from true to false on edit (AC-07)', async () => {
    const ticket = await createTicket();
    const created = (
      await request(app)
        .post(`/api/v1/staff/tickets/${ticket.id}/actions`)
        .set('Cookie', staff1Cookie)
        .send({ ...VALID_BODY, followUpRequired: true, followUpNote: 'Call back tomorrow.' })
    ).body;
    expect(created.followUpNote).toBe('Call back tomorrow.');
    const response = await request(app)
      .patch(`/api/v1/staff/tickets/${ticket.id}/actions/${created.id}`)
      .set('Cookie', staff1Cookie)
      .send({ ...VALID_BODY, followUpRequired: false, followUpNote: 'Call back tomorrow.' });
    expect(response.status).toBe(200);
    expect(response.body.followUpNote).toBeNull();
  });

  it('rejects edit of a nonexistent action with 404 ACTION_NOT_FOUND', async () => {
    const ticket = await createTicket();
    const response = await request(app)
      .patch(`/api/v1/staff/tickets/${ticket.id}/actions/00000000-0000-0000-0000-000000000000`)
      .set('Cookie', staff1Cookie)
      .send(VALID_BODY);
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('ACTION_NOT_FOUND');
  });

  it('rejects edit once the parent ticket is CLOSED, leaving the record unchanged (BR-08)', async () => {
    const ticket = await createTicket();
    const created = (
      await request(app).post(`/api/v1/staff/tickets/${ticket.id}/actions`).set('Cookie', staff1Cookie).send(VALID_BODY)
    ).body;
    await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'CLOSED' } });
    const response = await request(app)
      .patch(`/api/v1/staff/tickets/${ticket.id}/actions/${created.id}`)
      .set('Cookie', staff1Cookie)
      .send({ ...VALID_BODY, description: 'Should not be applied.' });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('TICKET_LOCKED');
    const reloaded = await prisma.actionTaken.findUniqueOrThrow({ where: { id: created.id } });
    expect(reloaded.description).toBe(VALID_BODY.description);
  });

  it('lists Action Taken records for a ticket, oldest first', async () => {
    const ticket = await createTicket();
    await request(app).post(`/api/v1/staff/tickets/${ticket.id}/actions`).set('Cookie', staff1Cookie).send(VALID_BODY);
    await request(app)
      .post(`/api/v1/staff/tickets/${ticket.id}/actions`)
      .set('Cookie', staff2Cookie)
      .send({ ...VALID_BODY, description: 'Second action.' });
    const response = await request(app).get(`/api/v1/staff/tickets/${ticket.id}/actions`).set('Cookie', staff1Cookie);
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(new Date(response.body[0].createdAt).getTime()).toBeLessThanOrEqual(new Date(response.body[1].createdAt).getTime());
  });

  it('returns 403 for a Requester caller on the staff namespace', async () => {
    const ticket = await createTicket();
    const response = await request(app)
      .post(`/api/v1/staff/tickets/${ticket.id}/actions`)
      .set('Cookie', requesterCookie)
      .send(VALID_BODY);
    expect(response.status).toBe(403);
  });
});
