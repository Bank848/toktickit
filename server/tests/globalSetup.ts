import { execSync } from 'child_process';
import { config } from 'dotenv';
import path from 'path';

export default async function globalSetup() {
  config({ path: path.resolve(__dirname, '../.env.test'), override: true });

  const cwd = path.resolve(__dirname, '..');
  // migrate reset --force drops and rebuilds the schema before applying migrations, so leftover
  // rows from a previous test run (e.g. ad hoc categories created by a single test) never carry
  // over and skew counts in an unrelated test.
  execSync('npx prisma migrate reset --force --skip-seed', { cwd, env: process.env, stdio: 'inherit' });
  execSync('npx prisma db seed', { cwd, env: process.env, stdio: 'inherit' });
}
