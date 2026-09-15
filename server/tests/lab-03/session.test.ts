import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../../src/prisma';
import {
  createSession,
  verifySessionToken,
  revokeSessionByToken,
  revokeAllSessionsForUser,
  hashToken,
} from '../../src/auth/session';
import { truncateSessionTable } from '../helpers/resetDb';

describe('session helper', () => {
  let requesterId: string;

  beforeEach(async () => {
    await truncateSessionTable();
    const requester = await prisma.user.findUniqueOrThrow({
      where: { email: 'requester@toktickit.local' },
    });
    requesterId = requester.id;
  });

  it('creates a session with a hashed token, expiring ~12h from now (A-02)', async () => {
    const before = Date.now();
    const { token, expiresAt } = await createSession(requesterId);

    expect(token).toHaveLength(64);
    expect(expiresAt.getTime()).toBeGreaterThan(before + 11 * 60 * 60 * 1000);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(before + 12 * 60 * 60 * 1000 + 5000);

    const row = await prisma.session.findUniqueOrThrow({ where: { tokenHash: hashToken(token) } });
    expect(row.userId).toBe(requesterId);
    expect(row.tokenHash).not.toBe(token);
  });

  it('verifies a freshly created session token', async () => {
    const { token } = await createSession(requesterId);
    const resolved = await verifySessionToken(token);
    expect(resolved?.userId).toBe(requesterId);
  });

  it('returns null for an unknown token', async () => {
    expect(await verifySessionToken('does-not-exist')).toBeNull();
  });

  it('returns null for an expired session (BR-10)', async () => {
    const { token } = await createSession(requesterId);
    await prisma.session.update({
      where: { tokenHash: hashToken(token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await verifySessionToken(token)).toBeNull();
  });

  it('returns null for a revoked session (BR-10)', async () => {
    const { token } = await createSession(requesterId);
    await prisma.session.update({
      where: { tokenHash: hashToken(token) },
      data: { revokedAt: new Date() },
    });
    expect(await verifySessionToken(token)).toBeNull();
  });

  it('revokeSessionByToken deletes the row so the token can never authenticate again (BR-09)', async () => {
    const { token } = await createSession(requesterId);
    await revokeSessionByToken(token);
    expect(await verifySessionToken(token)).toBeNull();
    expect(await prisma.session.findUnique({ where: { tokenHash: hashToken(token) } })).toBeNull();
  });

  it('revokeAllSessionsForUser deletes every session row for that user only', async () => {
    const other = await prisma.user.findUniqueOrThrow({ where: { email: 'requester2@toktickit.local' } });
    const mine1 = await createSession(requesterId);
    const mine2 = await createSession(requesterId);
    const theirs = await createSession(other.id);

    await revokeAllSessionsForUser(requesterId);

    expect(await verifySessionToken(mine1.token)).toBeNull();
    expect(await verifySessionToken(mine2.token)).toBeNull();
    expect(await verifySessionToken(theirs.token)).not.toBeNull();
  });
});
