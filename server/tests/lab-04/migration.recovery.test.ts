import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { applyPreLab4, createDisposableDb, lab4MigrationDir, runSql, schemaSnapshot } from '../helpers/migrationDb';

/** Finds the directory holding pg_dump and psql: PG_BIN_DIR, then PATH, then the usual install folders. */
function findPgBinDir(): string {
  const exe = (name: string) => (process.platform === 'win32' ? `${name}.exe` : name);
  const hasBoth = (dir: string) => existsSync(path.join(dir, exe('pg_dump'))) && existsSync(path.join(dir, exe('psql')));
  const candidates: string[] = [];
  if (process.env.PG_BIN_DIR) candidates.push(process.env.PG_BIN_DIR);
  candidates.push(...(process.env.PATH ?? '').split(path.delimiter).filter(Boolean));
  const roots = process.platform === 'win32'
    ? ['C:/Program Files/PostgreSQL', 'D:/PostgreSQL', 'C:/Program Files (x86)/PostgreSQL']
    : ['/usr/lib/postgresql', '/usr/local/pgsql', '/opt/homebrew/opt'];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    const versions = readdirSync(root).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const v of versions) candidates.push(path.join(root, v, 'bin'));
  }
  const found = candidates.find((dir) => hasBoth(dir));
  if (!found) {
    throw new Error(
      'pg_dump and psql were not found. Set PG_BIN_DIR to the PostgreSQL bin folder, or put it on PATH. ' +
        `Searched: PG_BIN_DIR, PATH, ${roots.join(', ')}.`,
    );
  }
  return found;
}

/** Runs a PostgreSQL client tool against `url`; the password travels only in the child's PGPASSWORD. */
function runPg(binDir: string, tool: 'pg_dump' | 'psql', url: string, args: string[]): void {
  const u = new URL(url);
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (u.password) env.PGPASSWORD = decodeURIComponent(u.password);
  else delete env.PGPASSWORD;
  const exe = path.join(binDir, process.platform === 'win32' ? `${tool}.exe` : tool);
  execFileSync(
    exe,
    ['-h', u.hostname, '-p', u.port || '5432', '-U', decodeURIComponent(u.username), '-d', u.pathname.slice(1), ...args],
    { env, stdio: 'pipe' },
  );
}

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
        createdAt: new Date('2026-09-20T10:05:00.000Z'),
      },
    });
    await c.actionTaken.create({
      data: {
        ticketId: ids.ticket, performedById: ids.staff, actionAt: new Date('2026-09-21T08:30:00.000Z'),
        description: 'Second record, with a follow-up', result: 'PENDING_FOLLOW_UP', followUpRequired: true,
        followUpNote: 'Check again tomorrow', attachmentNotes: 'photo of rack', idempotencyKey: 'rollback-key-2',
        createdAt: new Date('2026-09-21T08:35:00.000Z'),
      },
    });
    const ordered = () => c.actionTaken.findMany({ orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    const exported = await ordered();
    expect(exported).toHaveLength(2);

    // Export the records with pg_dump, exactly as docs/lab-04 specification 9.5.1 documents.
    const pgBin = findPgBinDir();
    const tmp = mkdtempSync(path.join(tmpdir(), 'ttk-dump-'));
    const dumpFile = path.join(tmp, 'ActionTaken.sql');
    try {
      runPg(pgBin, 'pg_dump', db.url, ['--data-only', '--table="ActionTaken"', '-f', dumpFile]);
      expect(readFileSync(dumpFile, 'utf8')).toContain('rollback-key-2');

      expect(runSql(db.url, downSql)).toBe(true);
      expect(await lab4Objects()).toEqual({ tables: 0, types: 0, indexes: 0, labels: 2 }); // enum values stay by design
      expect(await c.ticket.count({ where: { id: ids.ticket } })).toBe(1);
      expect(await c.user.count()).toBe(2);
      expect(await c.category.count()).toBe(1);

      expect(runSql(db.url, upSql)).toBe(true);
      expect(await schemaSnapshot(c)).toEqual(before);

      expect(await c.actionTaken.count()).toBe(0);
      runPg(pgBin, 'psql', db.url, ['-v', 'ON_ERROR_STOP=1', '-q', '-f', dumpFile]);
      const restored = await ordered();
      expect(restored).toEqual(exported); // ids, text, timestamps, idempotencyKey, performedById, createdAt order
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 180_000);
});
