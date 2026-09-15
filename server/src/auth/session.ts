import { randomBytes, createHash } from 'crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma';

export const TTK_SESSION_COOKIE = 'ttk_session';

// A-01/A-03: httpOnly + SameSite=Lax always; Secure only in production (local dev is plain HTTP).
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

// A-02: 12-hour fixed session lifetime, not renewed on activity.
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export interface CreatedSession {
  token: string;
  expiresAt: Date;
}

export interface ResolvedSession {
  id: string;
  userId: string;
}

// BR-08: only the SHA-256 hash of the raw token is ever persisted.
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId: string): Promise<CreatedSession> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  });
  return { token, expiresAt };
}

export async function verifySessionToken(token: string): Promise<ResolvedSession | null> {
  const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;
  return { id: session.id, userId: session.userId };
}

// BR-09: deletes the row outright — the same cookie can never authenticate again.
export async function revokeSessionByToken(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

// BR-26: used by the (later, out-of-scope-for-#36) admin password-reset endpoint. Accepts an
// optional Prisma transaction client (`tx`) so callers that must update the password hash and
// revoke sessions atomically (see #40 Task 30, api-spec.md BR-26/AC-30) can pass their
// `prisma.$transaction` callback's `tx` through instead of hitting the pool directly.
export async function revokeAllSessionsForUser(userId: string, tx?: Prisma.TransactionClient): Promise<void> {
  await (tx ?? prisma).session.deleteMany({ where: { userId } });
}
