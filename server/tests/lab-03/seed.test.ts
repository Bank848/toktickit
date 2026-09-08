import { describe, it, expect } from 'vitest';
import bcrypt from 'bcrypt';
import { execSync } from 'child_process';
import path from 'path';
import { prisma } from '../../src/prisma';

const SERVER_ROOT = path.resolve(__dirname, '../..');

describe('Lab 3 seed', () => {
  it('meets the minimum IT_STAFF and ADMINISTRATOR counts from spec §6.2', async () => {
    const activeStaff = await prisma.user.count({ where: { role: 'IT_STAFF', isActive: true } });
    const inactiveStaff = await prisma.user.count({ where: { role: 'IT_STAFF', isActive: false } });
    const activeAdmins = await prisma.user.count({ where: { role: 'ADMINISTRATOR', isActive: true } });

    expect(activeStaff).toBeGreaterThanOrEqual(3);
    expect(inactiveStaff).toBeGreaterThanOrEqual(1);
    expect(activeAdmins).toBeGreaterThanOrEqual(1);
  });

  it('seeds exactly one user with mustChangePassword true', async () => {
    const flagged = await prisma.user.findMany({ where: { mustChangePassword: true } });
    expect(flagged).toHaveLength(1);
    expect(flagged[0].email).toBe('onboarding@toktickit.local');
  });

  it('every existing Lab 2 Requester keeps mustChangePassword false and gains a bcrypt hash', async () => {
    const requester = await prisma.user.findUniqueOrThrow({
      where: { email: 'requester@toktickit.local' },
    });
    expect(requester.mustChangePassword).toBe(false);
    expect(requester.passwordHash).not.toBeNull();
    const matches = await bcrypt.compare('DevPass123!', requester.passwordHash as string);
    expect(matches).toBe(true);
  });

  it('re-running the seed is idempotent: no duplicate users, same counts', async () => {
    const before = await prisma.user.count();

    execSync('npx prisma db seed', { cwd: SERVER_ROOT, env: process.env, stdio: 'pipe' });

    const after = await prisma.user.count();
    expect(after).toBe(before);

    const byEmail = await prisma.user.groupBy({
      by: ['email'],
      _count: true,
      having: { email: { _count: { gt: 1 } } },
    });
    expect(byEmail).toHaveLength(0);
  });

  it('re-seeding preserves every migrated Lab 2 Requester id (FR-11 / BR-30)', async () => {
    const before = await prisma.user.findUniqueOrThrow({
      where: { email: 'requester@toktickit.local' },
    });

    execSync('npx prisma db seed', { cwd: SERVER_ROOT, env: process.env, stdio: 'pipe' });

    const after = await prisma.user.findUniqueOrThrow({
      where: { email: 'requester@toktickit.local' },
    });
    expect(after.id).toBe(before.id);
  });
});
