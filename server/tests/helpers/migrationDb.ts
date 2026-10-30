import { execSync } from 'child_process';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { PrismaClient } from '@prisma/client';

export const SERVER_DIR = path.resolve(__dirname, '../..');
export const MIGRATIONS_DIR = path.join(SERVER_DIR, 'prisma', 'migrations');

export function lab4MigrationDir(): string {
  const name = readdirSync(MIGRATIONS_DIR).find((d) => d.includes('lab4'));
  if (!name) throw new Error('Lab 4 migration folder not found');
  return path.join(MIGRATIONS_DIR, name);
}

/** Migration folders that come before Lab 4, oldest first. */
export function preLab4Migrations(): string[] {
  const lab4 = path.basename(lab4MigrationDir());
  return readdirSync(MIGRATIONS_DIR)
    .filter((d) => /^\d+_/.test(d) && d < lab4)
    .sort()
    .map((d) => path.join(MIGRATIONS_DIR, d));
}

function urlWithDatabase(dbName: string): string {
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = `/${dbName}`;
  return url.toString();
}

/** A throwaway database on the test server; the test database itself is never modified. */
export async function createDisposableDb(): Promise<{ url: string; client: PrismaClient; drop: () => Promise<void> }> {
  const admin = new PrismaClient();
  const dbName = `toktickit_mig_${process.pid}_${Date.now()}`;
  await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
  const url = urlWithDatabase(dbName);
  const client = new PrismaClient({ datasources: { db: { url } } });
  return {
    url,
    client,
    drop: async () => {
      await client.$disconnect();
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
      await admin.$disconnect();
    },
  };
}

/** Runs a multi-statement SQL file as one batch (prisma db execute); returns false when it fails. */
export function runSql(url: string, sql: string): boolean {
  const dir = mkdtempSync(path.join(tmpdir(), 'ttk-mig-'));
  const file = path.join(dir, 'script.sql');
  try {
    writeFileSync(file, sql);
    execSync(`npx prisma db execute --url "${url}" --file "${file}"`, { cwd: SERVER_DIR, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function runSqlFile(url: string, file: string): boolean {
  return runSql(url, readFileSync(file, 'utf8'));
}

export function applyPreLab4(url: string): void {
  for (const dir of preLab4Migrations()) {
    if (!runSqlFile(url, path.join(dir, 'migration.sql'))) throw new Error(`Failed to apply ${dir}`);
  }
}

/** Everything the Lab 4 migration touches, in a comparable form. */
export async function schemaSnapshot(client: PrismaClient) {
  const columns = await client.$queryRawUnsafe<{ table_name: string; column_name: string; data_type: string; is_nullable: string }[]>(
    `SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns
     WHERE table_schema = 'public' ORDER BY table_name, column_name`,
  );
  const indexes = await client.$queryRawUnsafe<{ indexname: string; indexdef: string }[]>(
    `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY indexname`,
  );
  const enums = await client.$queryRawUnsafe<{ typname: string; enumlabel: string }[]>(
    `SELECT t.typname, e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid ORDER BY t.typname, e.enumlabel`,
  );
  const constraints = await client.$queryRawUnsafe<{ conname: string; def: string }[]>(
    `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
     WHERE connamespace = 'public'::regnamespace ORDER BY conname`,
  );
  return { columns, indexes, enums, constraints };
}
