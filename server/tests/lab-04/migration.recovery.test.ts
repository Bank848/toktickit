import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { applyPreLab4, createDisposableDb, lab4MigrationDir, runSql, schemaSnapshot } from '../helpers/migrationDb';

// API-44: failed apply leaves nothing behind; apply, add records, roll back, re-apply.
// Runs in a disposable database; toktickit_test is never touched.
describe('Lab 4 migration recovery (failed apply and deliberate rollback)', () => {
  let db: Awaited<ReturnType<typeof createDisposableDb>>;
  const dir = lab4MigrationDir();
  const upSql = readFileSync(path.join(dir, 'migration.sql'), 'utf8');
  const downSql = readFileSync(path.join(dir, 'down.sql'), 'utf8');
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    db = await createDisposableDb();
    applyPreLab4(db.url);
    const c = db.client;
    const requester = await c.user.create({ data: { email: 'req@x.test', displayName: 'Req', role: 'REQUESTER' } });
    const staff = await c.user.create({ data: { email: 'staff@x.test', displayName: 'Staff', role: 'IT_STAFF' } });
    const category = await c.category.create({ data: { name: 'Network' } });
    const ticket = await c.ticket.create({
      data: {
        ticketNo: 'TKT-2026-09002', summary: 'Lab 3 ticket', description: 'Must survive a rollback.',
        requestedPriority: 'LOW', itPriority: 'LOW', requesterId: requester.id, categoryId: category.id,
      },
    });
    Object.assign(ids, { staff: staff.id, ticket: ticket.id });
  }, 120_000);

  afterAll(async () => {
    await db?.drop();
  }, 60_000);

  async function lab4Objects() {
    const tables = await db.client.$queryRawUnsafe<{ n: string }[]>(
      `SELECT table_name AS n FROM information_schema.tables WHERE table_schema='public' AND table_name='ActionTaken'`,
    );
    const types = await db.client.$queryRawUnsafe<{ n: string }[]>(`SELECT typname AS n FROM pg_type WHERE typname='ActionResult'`);
    const indexes = await db.client.$queryRawUnsafe<{ n: string }[]>(
      `SELECT indexname AS n FROM pg_indexes WHERE schemaname='public' AND indexname IN
       ('ActionTaken_ticketId_actionAt_idx','ActionTaken_ticketId_performedById_idempotencyKey_key','Ticket_ownerId_status_idx','Ticket_updatedAt_idx')`,
    );
    const labels = await db.client.$queryRawUnsafe<{ n: string }[]>(
      `SELECT enumlabel AS n FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
       WHERE t.typname='TicketEventType' AND e.enumlabel LIKE 'ACTION_TAKEN%'`,
    );
    return { tables: tables.length, types: types.length, indexes: indexes.length, labels: labels.length };
  }

  it('a failing last statement rolls back every earlier statement, and a clean retry succeeds', async () => {
    const broken = upSql.replace(/COMMIT;\s*$/, 'SELECT * FROM "TableThatDoesNotExist";\n\nCOMMIT;\n');
    expect(broken).not.toBe(upSql);
    expect(runSql(db.url, broken)).toBe(false);
    expect(await lab4Objects()).toEqual({ tables: 0, types: 0, indexes: 0, labels: 0 });

    expect(runSql(db.url, upSql)).toBe(true);
    expect(await lab4Objects()).toEqual({ tables: 1, types: 1, indexes: 4, labels: 2 });
  }, 120_000);

  it('down.sql removes the Lab 4 objects, keeps Lab 3 rows, and a re-apply restores the same schema and records', async () => {
    const c = db.client;
    const before = await schemaSnapshot(c);

    await c.actionTaken.create({
      data: {
        ticketId: ids.ticket, performedById: ids.staff, actionAt: new Date('2026-09-20T10:00:00.000Z'),
        description: 'Recorded before rollback', result: 'ESCALATED', idempotencyKey: 'rollback-key',
      },
    });
    // Stands in for `pg_dump --data-only --table="ActionTaken"`: keep the rows to restore later.
    const exported = await c.actionTaken.findMany();
    expect(exported).toHaveLength(1);

    expect(runSql(db.url, downSql)).toBe(true);
    expect(await lab4Objects()).toEqual({ tables: 0, types: 0, indexes: 0, labels: 2 }); // enum values stay by design
    expect(await c.ticket.count({ where: { id: ids.ticket } })).toBe(1);
    expect(await c.user.count()).toBe(2);
    expect(await c.category.count()).toBe(1);

    expect(runSql(db.url, upSql)).toBe(true);
    expect(await schemaSnapshot(c)).toEqual(before);

    await c.actionTaken.createMany({ data: exported });
    const restored = await c.actionTaken.findMany();
    expect(restored).toEqual(exported);
  }, 180_000);
});
