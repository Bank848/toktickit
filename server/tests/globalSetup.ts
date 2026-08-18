import { execSync } from 'child_process';
import { config } from 'dotenv';
import path from 'path';

export default async function globalSetup() {
  config({ path: path.resolve(__dirname, '../.env.test'), override: true });

  const cwd = path.resolve(__dirname, '..');
  execSync('npx prisma migrate deploy', { cwd, env: process.env, stdio: 'inherit' });
  execSync('npx prisma db seed', { cwd, env: process.env, stdio: 'inherit' });
}
