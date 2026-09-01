// Prepares the dedicated Lab 2 E2E database (toktickit_e2e) before Playwright runs:
// reset schema, apply migrations, seed reference data. Deliberately separate from
// server/tests/globalSetup.ts (which resets toktickit_test for Vitest) so a Playwright
// run and a Vitest run never race over the same database.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { config } from 'dotenv';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, '..');
const serverDir = path.join(repoRoot, 'server');
const envPath = path.join(serverDir, '.env.e2e');

const loaded = config({ path: envPath, override: true });
if (loaded.error) {
  console.error(
    `Missing ${envPath}. Copy server/.env.e2e.example to server/.env.e2e and point it at a ` +
      'dedicated /toktickit_e2e database before running the E2E suite.',
  );
  process.exit(1);
}

// Safety guard, mirrors the /toktickit_test guard prisma tests already rely on: refuse to run
// destructive reset/migrate commands against anything other than the dedicated E2E database, so
// a misconfigured .env.e2e can never wipe a developer's real toktickit or toktickit_test data.
const databaseUrl = loaded.parsed?.DATABASE_URL;
let parsed;
try {
  parsed = new URL(databaseUrl ?? '');
} catch {
  parsed = null;
}
if (!parsed || !['postgres:', 'postgresql:'].includes(parsed.protocol) || parsed.pathname !== '/toktickit_e2e') {
  console.error('server/.env.e2e DATABASE_URL must point to the dedicated /toktickit_e2e database.');
  process.exit(1);
}

const childEnv = { ...process.env, ...loaded.parsed, DATABASE_URL: parsed.toString() };
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const commands = [
  ['prisma', 'migrate', 'reset', '--force', '--skip-seed'],
  ['prisma', 'migrate', 'deploy'],
  ['prisma', 'db', 'seed'],
];

for (const args of commands) {
  const result = spawnSync(npxCommand, args, { cwd: serverDir, env: childEnv, stdio: 'inherit', shell: true });
  if (result.error) {
    console.error(`Unable to run npx ${args.join(' ')}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('Prepared and seeded the dedicated toktickit_e2e database.');
