import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { applyPreLab4, createDisposableDb, lab4MigrationDir, runSqlFile } from '../helpers/migrationDb';

// API-35: the Lab 4 migration applied over Lab 3 data loses no row and changes no id.
describe('Lab 4 migration over Lab 3 data', () => {
  let db: Awaited<ReturnType<typeof createDisposableDb>>;
  const ids: Record<string, string> = {};
  let attachmentBefore: Record<string, unknown>;

  beforeAll(async () => {
    db = await createDisposableDb();
    applyPreLab4(db.url);
    const c = db.client;
    const requester = await c.user.create({ data: { email: 'req@x.test', displayName: 'Req', role: 'REQUESTER' } });
    const staff = await c.user.create({ data: { email: 'staff@x.test', displayName: 'Staff', role: 'IT_STAFF' } });
    const category = await c.category.create({ data: { name: 'Network' } });
    const ticket = await c.ticket.create({
      data: {
        ticketNo: 'TKT-2026-09001', summary: 'Old ticket', description: 'Created before Lab 4.',
        status: 'IN_PROGRESS', requestedPriority: 'MEDIUM', itPriority: 'HIGH',
        requesterId: requester.id, ownerId: staff.id, categoryId: category.id,
      },
    });
    const comment = await c.comment.create({ data: { ticketId: ticket.id, authorId: requester.id, body: 'Hello' } });
    const note = await c.internalNote.create({ data: { ticketId: ticket.id, authorId: staff.id, body: 'Internal' } });
    const event = await c.ticketEvent.create({ data: { ticketId: ticket.id, actorId: staff.id, eventType: 'COMMENT_ADDED' } });
    const attachment = await c.attachment.create({
      data: {
        ticketId: ticket.id, uploadedById: requester.id, originalFilename: 'screenshot.png', mimeType: 'image/png',
        sizeBytes: 2048, storageKey: 'lab3/2026/09/screenshot-abc123.png',
        createdAt: new Date('2026-09-01T08:30:00.000Z'),
      },
    });
    const removed = await c.attachment.create({
      data: {
        ticketId: ticket.id, uploadedById: requester.id, originalFilename: 'old.pdf', mimeType: 'application/pdf',
        sizeBytes: 4096, storageKey: 'lab3/2026/09/old-def456.pdf', createdAt: new Date('2026-09-02T09:00:00.000Z'),
        deletedAt: new Date('2026-09-03T10:00:00.000Z'), deletedById: staff.id, deletedReason: 'Wrong file',
      },
    });
    attachmentBefore = { live: attachment, removed };
    Object.assign(ids, {
      requester: requester.id, staff: staff.id, category: String(category.id), ticket: ticket.id,
      comment: comment.id, note: note.id, event: event.id,
    });
    const applied = runSqlFile(db.url, path.join(lab4MigrationDir(), 'migration.sql'));
    expect(applied).toBe(true);
  }, 120_000);

  afterAll(async () => {
    await db?.drop();
  }, 60_000);

  it('keeps every Lab 3 row and id', async () => {
    const c = db.client;
    expect((await c.user.findMany({ select: { id: true } })).map((u) => u.id).sort()).toEqual([ids.requester, ids.staff].sort());
    expect((await c.category.findMany()).map((x) => String(x.id))).toEqual([ids.category]);
    const ticket = await c.ticket.findUniqueOrThrow({ where: { id: ids.ticket } });
    expect(ticket.ticketNo).toBe('TKT-2026-09001');
    expect(ticket.status).toBe('IN_PROGRESS');
    expect(ticket.itPriority).toBe('HIGH');
    expect(await c.comment.count({ where: { id: ids.comment } })).toBe(1);
    expect(await c.internalNote.count({ where: { id: ids.note } })).toBe(1);
    expect(await c.ticketEvent.count({ where: { id: ids.event } })).toBe(1);
  });

  it('keeps every Lab 3 Attachment row, id and metadata field unchanged', async () => {
    const c = db.client;
    const live = attachmentBefore.live as { id: string };
    const removed = attachmentBefore.removed as { id: string };
    expect((await c.attachment.findMany({ select: { id: true } })).map((a) => a.id).sort()).toEqual([live.id, removed.id].sort());
    expect(await c.attachment.findUniqueOrThrow({ where: { id: live.id } })).toEqual(attachmentBefore.live);
    expect(await c.attachment.findUniqueOrThrow({ where: { id: removed.id } })).toEqual(attachmentBefore.removed);
    const after = await c.attachment.findUniqueOrThrow({ where: { id: removed.id } });
    expect(after.deletedById).toBe(ids.staff);
    expect(after.deletedReason).toBe('Wrong file');
  });

  it('gives every existing Ticket zero actions and accepts new ones', async () => {
    const c = db.client;
    expect(await c.actionTaken.count({ where: { ticketId: ids.ticket } })).toBe(0);
    const action = await c.actionTaken.create({
      data: {
        ticketId: ids.ticket, performedById: ids.staff, actionAt: new Date(), description: 'First',
        result: 'RESOLVED', idempotencyKey: 'k',
      },
    });
    expect(action.id).toBeDefined();
    await c.ticketEvent.create({ data: { ticketId: ids.ticket, actorId: ids.staff, eventType: 'ACTION_TAKEN_ADDED' } });
  });

  it('creates the four named indexes', async () => {
    const rows = await db.client.$queryRawUnsafe<{ indexname: string }[]>(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public'`,
    );
    const names = rows.map((r) => r.indexname);
    for (const n of [
      'ActionTaken_ticketId_actionAt_idx',
      'ActionTaken_ticketId_performedById_idempotencyKey_key',
      'Ticket_ownerId_status_idx',
      'Ticket_updatedAt_idx',
    ]) expect(names).toContain(n);
  });

  it('is wrapped in BEGIN/COMMIT and ships a down.sql', () => {
    const sql = readFileSync(path.join(lab4MigrationDir(), 'migration.sql'), 'utf8').trim();
    expect(sql.startsWith('BEGIN;')).toBe(true);
    expect(sql.endsWith('COMMIT;')).toBe(true);
    expect(readFileSync(path.join(lab4MigrationDir(), 'down.sql'), 'utf8')).toContain('DROP TABLE "ActionTaken"');
  });
});
