import { randomBytes, createHash } from 'crypto';
import { prisma } from '../../src/prisma';

// Matches specification.md §6 (Session model) and api-spec.md's "Session cookie" note exactly:
// cookie name ttk_session, tokenHash = SHA-256 of the raw token, 12h default lifetime. Building
// the Session row directly (rather than going through POST /auth/login) keeps these tests
// independent of the seeded dev password, which is #36/#35's concern, not #37's.
const SESSION_COOKIE_NAME = 'ttk_session';

export async function createSessionCookieFor(
  userId: string,
  options: { expiresInMs?: number; revoked?: boolean } = {},
): Promise<string> {
  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + (options.expiresInMs ?? 12 * 60 * 60 * 1000)),
      revokedAt: options.revoked ? new Date() : null,
    },
  });
  return `${SESSION_COOKIE_NAME}=${rawToken}`;
}
