import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma';
import { truncateTicketTables } from '../helpers/resetDb';
import { loginAs } from '../helpers/auth';
import { SEED_EMAILS } from '../helpers/staffFixtures';
import { generateTicketNumber } from '../../src/services/ticketNumber';

const VALID_BODY = {
  actionAt: '2026-09-20T10:00:00.000Z',
  description: 'Rebooted the conference-room access point.',
  result: 'RESOLVED',
  followUpRequired: false,
};

describe('Action Taken API (staff routes and Requester read-only route)', () => {
  let staff1Cookie: string;
  let staff2Cookie: string;
  let requesterCookie: string;
  let requester2Cookie: string;
  let requesterId: string;
  let staff1Id: string;
  let staff2Id: string;
  let categoryId: number;

  beforeAll(async () => {
    staff1Cookie = await loginAs(SEED_EMAILS.itStaff1);
    staff2Cookie = await loginAs(SEED_EMAILS.itStaff2);
    requesterCookie = await loginAs(SEED_EMAILS.requester);
    requester2Cookie = await loginAs(SEED_EMAILS.requester2);
    requesterId = (await prisma.user.findUniqueOrThrow({ where: { email: SEED_EMAILS.requester } })).id;
    staff1Id = (await prisma.user.findUniqueOrThrow({ where: { email: SEED_EMAILS.itStaff1 } })).id;
    staff2Id = (await prisma.user.findUniqueOrThrow({ where: { email: SEED_EMAILS.itStaff2 } })).id;
    categoryId = (await prisma.category.findFirstOrThrow({ where: { isActive: true } })).id;
  });

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

  function post(ticketId: string, cookie: string, body: object = VALID_BODY, key: string | null = randomUUID()) {
    const r = request(app).post(`/api/v1/staff/tickets/${ticketId}/actions`).set('Cookie', cookie);
    if (key !== null) r.set('Idempotency-Key', key);
    return r.send(body);
  }

  function patch(ticketId: string, actionId: string, cookie: string, body: object, ifMatch: string | null) {
    const r = request(app).patch(`/api/v1/staff/tickets/${ticketId}/actions/${actionId}`).set('Cookie', cookie);
    if (ifMatch !== null) r.set('If-Match', ifMatch);
    return r.send(body);
  }

  async function createAction(ticketId: string, cookie: string = staff1Cookie, body: object = VALID_BODY) {
    const response = await post(ticketId, cookie, body);
    expect(response.status).toBe(201);
    return response.body as { id: string; etag: string; updatedAt: string };
  }

  // ---- create (API-01..05, 10..12) ----

  it('API-01: IT Staff creates an Action Taken; performedBy is the session user', async () => {
    const ticket = await createTicket();
    const response = await post(ticket.id, staff1Cookie);
    expect(response.status).toBe(201);
    expect(response.body.performedBy.id).toBe(staff1Id);
    expect(response.body.lastEditedBy).toBeNull();
    expect(response.body.ticketId).toBe(ticket.id);
    expect(response.body.etag).toBe(`"${response.body.updatedAt}"`);
    expect(response.headers.etag).toBe(response.body.etag);
  });

  it('API-02: a foreign performedById in the body is ignored', async () => {
    const ticket = await createTicket();
    const response = await post(ticket.id, staff1Cookie, { ...VALID_BODY, performedById: staff2Id, performedBy: staff2Id });
    expect(response.status).toBe(201);
    expect(response.body.performedBy.id).toBe(staff1Id);
  });

  it('API-03: an invalid body is 422 and nothing is created', async () => {
    const ticket = await createTicket();
    const response = await post(ticket.id, staff1Cookie, { ...VALID_BODY, result: 'NOT_A_RESULT' });
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(await prisma.actionTaken.count({ where: { ticketId: ticket.id } })).toBe(0);
  });

  it('API-04: create on an unknown Ticket is 404 TICKET_NOT_FOUND', async () => {
    const response = await post('00000000-0000-0000-0000-000000000000', staff1Cookie);
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('TICKET_NOT_FOUND');
  });

  it('API-05: create on CLOSED, then CANCELLED, is 409 TICKET_LOCKED and writes nothing', async () => {
    for (const status of ['CLOSED', 'CANCELLED']) {
      const ticket = await createTicket(status);
      const response = await post(ticket.id, staff1Cookie);
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('TICKET_LOCKED');
      expect(await prisma.actionTaken.count({ where: { ticketId: ticket.id } })).toBe(0);
    }
  });

  it('API-10: create then edit writes ACTION_TAKEN_ADDED then ACTION_TAKEN_UPDATED events', async () => {
    const ticket = await createTicket();
    const created = await createAction(ticket.id);
    const edit = await patch(ticket.id, created.id, staff1Cookie, VALID_BODY, created.etag);
    expect(edit.status).toBe(200);
    const events = await prisma.ticketEvent.findMany({
      where: { ticketId: ticket.id, eventType: { in: ['ACTION_TAKEN_ADDED', 'ACTION_TAKEN_UPDATED'] } },
      orderBy: { createdAt: 'asc' },
    });
    expect(events.map((e) => e.eventType)).toEqual(['ACTION_TAKEN_ADDED', 'ACTION_TAKEN_UPDATED']);
    expect(events.every((e) => (e.payload as { actionId: string }).actionId === created.id)).toBe(true);
  });

  it('API-11: create and edit leave the parent Ticket updatedAt unchanged', async () => {
    const ticket = await createTicket();
    const created = await createAction(ticket.id);
    await patch(ticket.id, created.id, staff2Cookie, { ...VALID_BODY, description: 'Edited.' }, created.etag);
    const reloaded = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(reloaded.updatedAt.getTime()).toBe(ticket.updatedAt.getTime());
  });

  it('API-12: attachmentNotes creates no Attachment row', async () => {
    const ticket = await createTicket();
    await post(ticket.id, staff1Cookie, { ...VALID_BODY, attachmentNotes: 'Photo shared via email.' });
    expect(await prisma.attachment.count({ where: { ticketId: ticket.id } })).toBe(0);
  });

  // ---- edit (API-06..09) ----

  it('API-06: user B edits a record by user A; performedBy stays A, lastEditedBy is B', async () => {
    const ticket = await createTicket();
    const created = await createAction(ticket.id, staff1Cookie);
    const response = await patch(ticket.id, created.id, staff2Cookie, { ...VALID_BODY, description: 'Replaced the AP.' }, created.etag);
    expect(response.status).toBe(200);
    expect(response.body.performedBy.id).toBe(staff1Id);
    expect(response.body.lastEditedBy.id).toBe(staff2Id);
    expect(response.body.description).toBe('Replaced the AP.');
  });

  it('API-07: flipping followUpRequired true to false clears the stored note', async () => {
    const ticket = await createTicket();
    const created = await createAction(ticket.id, staff1Cookie, { ...VALID_BODY, followUpRequired: true, followUpNote: 'Call back.' });
    const response = await patch(
      ticket.id, created.id, staff1Cookie, { ...VALID_BODY, followUpRequired: false, followUpNote: 'Call back.' }, created.etag,
    );
    expect(response.status).toBe(200);
    expect(response.body.followUpNote).toBeNull();
    const stored = await prisma.actionTaken.findUniqueOrThrow({ where: { id: created.id } });
    expect(stored.followUpNote).toBeNull();
  });

  it('API-08: edit of an unknown action id is 404 ACTION_NOT_FOUND', async () => {
    const ticket = await createTicket();
    const response = await patch(ticket.id, '00000000-0000-0000-0000-000000000000', staff1Cookie, VALID_BODY, '"2026-01-01T00:00:00.000Z"');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('ACTION_NOT_FOUND');
  });

  it('API-09: edit after the Ticket is CLOSED is 409 TICKET_LOCKED and the record is unchanged', async () => {
    const ticket = await createTicket();
    const created = await createAction(ticket.id);
    await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'CLOSED' } });
    const response = await patch(ticket.id, created.id, staff1Cookie, { ...VALID_BODY, description: 'Nope.' }, created.etag);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('TICKET_LOCKED');
    const stored = await prisma.actionTaken.findUniqueOrThrow({ where: { id: created.id } });
    expect(stored.description).toBe(VALID_BODY.description);
  });

  // ---- list and ordering (API-13, 46) ----

  it('API-13: the list is oldest first', async () => {
    const ticket = await createTicket();
    await createAction(ticket.id, staff1Cookie);
    await createAction(ticket.id, staff2Cookie, { ...VALID_BODY, description: 'Second action.' });
    const response = await request(app).get(`/api/v1/staff/tickets/${ticket.id}/actions`).set('Cookie', staff1Cookie);
    expect(response.status).toBe(200);
    expect(response.body.map((a: { description: string }) => a.description)).toEqual([VALID_BODY.description, 'Second action.']);
    expect(response.body[0].etag).toBeDefined();
  });

  it('API-46: two actions with identical createdAt list in stable id-ascending order', async () => {
    const ticket = await createTicket();
    const sameInstant = new Date('2026-09-20T10:00:00.000Z');
    // Inserted high id first, so insertion order differs from id order.
    for (const id of ['ffffffff-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002']) {
      await prisma.actionTaken.create({
        data: {
          id, ticketId: ticket.id, performedById: staff1Id, actionAt: sameInstant, description: id,
          result: 'RESOLVED', createdAt: sameInstant,
        },
      });
    }
    const expected = ['00000000-0000-4000-8000-000000000002', 'ffffffff-0000-4000-8000-000000000001'];
    for (let i = 0; i < 3; i += 1) {
      const staff = await request(app).get(`/api/v1/staff/tickets/${ticket.id}/actions`).set('Cookie', staff1Cookie);
      expect(staff.body.map((a: { id: string }) => a.id)).toEqual(expected);
      const req = await request(app).get(`/api/v1/tickets/${ticket.id}/actions`).set('Cookie', requesterCookie);
      expect(req.body.map((a: { id: string }) => a.id)).toEqual(expected);
    }
  });

  // ---- roles and Requester read-only route (API-14..17) ----

  it('API-14: a Requester calling a staff actions route gets 403 FORBIDDEN_ROLE', async () => {
    const ticket = await createTicket();
    const response = await post(ticket.id, requesterCookie);
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN_ROLE');
  });

  it('API-15: a Requester sees every field of every action on an owned Ticket', async () => {
    const ticket = await createTicket();
    await createAction(ticket.id, staff1Cookie, {
      ...VALID_BODY, followUpRequired: true, followUpNote: 'Check Monday.', attachmentNotes: 'Photo on LINE.',
    });
    const response = await request(app).get(`/api/v1/tickets/${ticket.id}/actions`).set('Cookie', requesterCookie);
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    const staffView = await request(app).get(`/api/v1/staff/tickets/${ticket.id}/actions`).set('Cookie', staff1Cookie);
    expect(response.body).toEqual(staffView.body);
    expect(response.body[0]).toMatchObject({
      description: VALID_BODY.description, followUpRequired: true, followUpNote: 'Check Monday.',
      attachmentNotes: 'Photo on LINE.', lastEditedBy: null,
    });
    expect(response.body[0].performedBy.displayName).toBeDefined();
  });

  it('API-16: another user\'s Ticket and an unknown id give the same 404 TICKET_NOT_ACCESSIBLE body', async () => {
    const ticket = await createTicket();
    const other = await request(app).get(`/api/v1/tickets/${ticket.id}/actions`).set('Cookie', requester2Cookie);
    const unknown = await request(app).get('/api/v1/tickets/00000000-0000-0000-0000-000000000000/actions').set('Cookie', requester2Cookie);
    expect(other.status).toBe(404);
    expect(other.body.error.code).toBe('TICKET_NOT_ACCESSIBLE');
    expect(unknown.status).toBe(404);
    expect({ ...other.body.error, correlationId: 'x' }).toEqual({ ...unknown.body.error, correlationId: 'x' });
  });

  it('API-17: Requester POST and PATCH on their actions path are 404, not 403 or 405', async () => {
    const ticket = await createTicket();
    const created = await createAction(ticket.id);
    const postRes = await request(app).post(`/api/v1/tickets/${ticket.id}/actions`).set('Cookie', requesterCookie).send(VALID_BODY);
    const patchRes = await request(app)
      .patch(`/api/v1/tickets/${ticket.id}/actions/${created.id}`).set('Cookie', requesterCookie)
      .set('If-Match', created.etag).send(VALID_BODY);
    expect(postRes.status).toBe(404);
    expect(patchRes.status).toBe(404);
  });

  // ---- stale-write protection (API-37..39) ----

  it('API-37: the list carries a distinct etag per record; PATCH with an older If-Match is 409 STALE_UPDATE', async () => {
    const ticket = await createTicket();
    const a = await createAction(ticket.id);
    await new Promise((r) => setTimeout(r, 5));
    const b = await createAction(ticket.id);
    const list = await request(app).get(`/api/v1/staff/tickets/${ticket.id}/actions`).set('Cookie', staff1Cookie);
    expect(list.body[0].etag).not.toBe(list.body[1].etag);

    const first = await patch(ticket.id, a.id, staff2Cookie, { ...VALID_BODY, description: 'Winner.' }, a.etag);
    expect(first.status).toBe(200);
    expect(first.body.etag).not.toBe(a.etag);
    const stale = await patch(ticket.id, a.id, staff1Cookie, { ...VALID_BODY, description: 'Loser.' }, a.etag);
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('STALE_UPDATE');
    const stored = await prisma.actionTaken.findUniqueOrThrow({ where: { id: a.id } });
    expect(stored.description).toBe('Winner.');
    // The other record's etag is not valid for this one.
    const wrong = await patch(ticket.id, a.id, staff1Cookie, VALID_BODY, b.etag);
    expect(wrong.status).toBe(409);
  });

  it('API-38: two simultaneous PATCHes with one If-Match give exactly one 200 and one 409', async () => {
    const ticket = await createTicket();
    const created = await createAction(ticket.id);
    const [r1, r2] = await Promise.all([
      patch(ticket.id, created.id, staff1Cookie, { ...VALID_BODY, description: 'From one.' }, created.etag),
      patch(ticket.id, created.id, staff2Cookie, { ...VALID_BODY, description: 'From two.' }, created.etag),
    ]);
    expect([r1.status, r2.status].sort()).toEqual([200, 409]);
    const winner = r1.status === 200 ? r1 : r2;
    const loser = r1.status === 200 ? r2 : r1;
    expect(loser.body.error.code).toBe('STALE_UPDATE');
    const stored = await prisma.actionTaken.findUniqueOrThrow({ where: { id: created.id } });
    expect(stored.description).toBe(winner.body.description);
    expect(`"${stored.updatedAt.toISOString()}"`).toBe(winner.body.etag);
    expect(await prisma.ticketEvent.count({ where: { ticketId: ticket.id, eventType: 'ACTION_TAKEN_UPDATED' } })).toBe(1);
  });

  it('API-39: PATCH with no If-Match is 428 PRECONDITION_REQUIRED and the record is unchanged', async () => {
    const ticket = await createTicket();
    const created = await createAction(ticket.id);
    const response = await patch(ticket.id, created.id, staff1Cookie, { ...VALID_BODY, description: 'Nope.' }, null);
    expect(response.status).toBe(428);
    expect(response.body.error.code).toBe('PRECONDITION_REQUIRED');
    const stored = await prisma.actionTaken.findUniqueOrThrow({ where: { id: created.id } });
    expect(stored.description).toBe(VALID_BODY.description);
    expect(stored.lastEditedById).toBeNull();
  });

  // ---- lock race against a concurrent status change (BR-08) ----

  /** Holds an uncommitted CLOSED update on the Ticket row; call release() to commit it. */
  async function holdTicketClosed(ticketId: string) {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let ready!: () => void;
    const readyP = new Promise<void>((resolve) => { ready = resolve; });
    const done = prisma.$transaction(async (tx) => {
      await tx.$executeRaw`UPDATE "Ticket" SET "status" = 'CLOSED' WHERE "id" = ${ticketId}`;
      ready();
      await gate;
    });
    await readyP;
    return { release, done };
  }

  const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  it('API-48: a create that races a status change to CLOSED is 409 TICKET_LOCKED and writes nothing', async () => {
    const ticket = await createTicket();
    const hold = await holdTicketClosed(ticket.id);
    const pending = post(ticket.id, staff1Cookie).then((r) => r); // passes the early check: CLOSED is not committed yet
    await settle(500);
    hold.release();
    await hold.done;
    const response = await pending;
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('TICKET_LOCKED');
    expect(await prisma.actionTaken.count({ where: { ticketId: ticket.id } })).toBe(0);
    expect(await prisma.ticketEvent.count({ where: { ticketId: ticket.id, eventType: 'ACTION_TAKEN_ADDED' } })).toBe(0);
  });

  it('API-49: an edit that races a status change to CLOSED is 409 TICKET_LOCKED; record and events unchanged', async () => {
    const ticket = await createTicket();
    const action = await createAction(ticket.id);
    const hold = await holdTicketClosed(ticket.id);
    const pending = patch(ticket.id, action.id, staff1Cookie, { ...VALID_BODY, description: 'Edited during the race.' }, action.etag).then((r) => r);
    await settle(500);
    hold.release();
    await hold.done;
    const response = await pending;
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('TICKET_LOCKED');
    const stored = await prisma.actionTaken.findUniqueOrThrow({ where: { id: action.id } });
    expect(stored.description).toBe(VALID_BODY.description);
    expect(stored.lastEditedById).toBeNull();
    expect(await prisma.ticketEvent.count({ where: { ticketId: ticket.id, eventType: 'ACTION_TAKEN_UPDATED' } })).toBe(0);
  });

  // ---- idempotent create (API-41..43) ----

  it('API-41: the same body and key twice gives 201 then 200 with Idempotent-Replayed, one row, one event', async () => {
    const ticket = await createTicket();
    const key = randomUUID();
    const first = await post(ticket.id, staff1Cookie, VALID_BODY, key);
    const second = await post(ticket.id, staff1Cookie, VALID_BODY, key);
    expect(first.status).toBe(201);
    expect(first.headers['idempotent-replayed']).toBeUndefined();
    expect(second.status).toBe(200);
    expect(second.headers['idempotent-replayed']).toBe('true');
    expect(second.body).toEqual(first.body);
    expect(await prisma.actionTaken.count({ where: { ticketId: ticket.id } })).toBe(1);
    expect(await prisma.ticketEvent.count({ where: { ticketId: ticket.id, eventType: 'ACTION_TAKEN_ADDED' } })).toBe(1);
  });

  it('API-42: two simultaneous POSTs with one key give one row and the same record id', async () => {
    const ticket = await createTicket();
    const key = randomUUID();
    const [r1, r2] = await Promise.all([
      post(ticket.id, staff1Cookie, VALID_BODY, key),
      post(ticket.id, staff1Cookie, VALID_BODY, key),
    ]);
    expect([r1.status, r2.status].sort()).toEqual([200, 201]);
    expect(r1.body.id).toBe(r2.body.id);
    expect(await prisma.actionTaken.count({ where: { ticketId: ticket.id } })).toBe(1);
    expect(await prisma.ticketEvent.count({ where: { ticketId: ticket.id, eventType: 'ACTION_TAKEN_ADDED' } })).toBe(1);
  });

  it('API-43: the same key with a different body is 409 IDEMPOTENCY_KEY_REUSED; no key or a bad key is 428', async () => {
    const ticket = await createTicket();
    const key = randomUUID();
    expect((await post(ticket.id, staff1Cookie, VALID_BODY, key)).status).toBe(201);
    const reused = await post(ticket.id, staff1Cookie, { ...VALID_BODY, description: 'Different.' }, key);
    expect(reused.status).toBe(409);
    expect(reused.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');

    const missing = await post(ticket.id, staff1Cookie, VALID_BODY, null);
    expect(missing.status).toBe(428);
    expect(missing.body.error.code).toBe('PRECONDITION_REQUIRED');
    const malformed = await post(ticket.id, staff1Cookie, VALID_BODY, 'not-a-uuid');
    expect(malformed.status).toBe(428);
    expect(await prisma.actionTaken.count({ where: { ticketId: ticket.id } })).toBe(1);
  });

  it('a new key creates a second record (genuine records are never merged)', async () => {
    const ticket = await createTicket();
    expect((await post(ticket.id, staff1Cookie)).status).toBe(201);
    expect((await post(ticket.id, staff1Cookie)).status).toBe(201);
    expect(await prisma.actionTaken.count({ where: { ticketId: ticket.id } })).toBe(2);
  });

  // ---- append-only reading (API-45) ----

  it('API-45: two edits keep performedBy, track the latest editor, write two events, and no delete route exists', async () => {
    const ticket = await createTicket();
    const created = await createAction(ticket.id, staff1Cookie);
    const e1 = await patch(ticket.id, created.id, staff2Cookie, { ...VALID_BODY, description: 'Edit one.' }, created.etag);
    expect(e1.status).toBe(200);
    const e2 = await patch(ticket.id, created.id, staff1Cookie, { ...VALID_BODY, description: 'Edit two.' }, e1.body.etag);
    expect(e2.status).toBe(200);
    expect(e2.body.performedBy.id).toBe(staff1Id);
    expect(e2.body.lastEditedBy.id).toBe(staff1Id);
    expect(e1.body.lastEditedBy.id).toBe(staff2Id);
    expect(await prisma.ticketEvent.count({ where: { ticketId: ticket.id, eventType: 'ACTION_TAKEN_UPDATED' } })).toBe(2);

    const del = await request(app).delete(`/api/v1/staff/tickets/${ticket.id}/actions/${created.id}`).set('Cookie', staff1Cookie);
    expect(del.status).toBe(404);
    expect(await prisma.actionTaken.count({ where: { id: created.id } })).toBe(1);
  });
});
