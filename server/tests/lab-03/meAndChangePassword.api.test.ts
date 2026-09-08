import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma';
import { createSession, TTK_SESSION_COOKIE } from '../../src/auth/session';
import { hashPassword, verifyPassword } from '../../src/auth/password';

async function loginCookieFor(email: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const { token } = await createSession(user.id);
  return `${TTK_SESSION_COOKIE}=${token}`;
}

describe('GET /api/v1/me', () => {
  it('returns id/email/displayName/role/mustChangePassword from the session', async () => {
    const cookie = await loginCookieFor('requester@toktickit.local');
    const response = await request(app).get('/api/v1/me').set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      email: 'requester@toktickit.local',
      role: 'REQUESTER',
      mustChangePassword: false,
    });
  });
});

describe('POST /api/v1/auth/change-password', () => {
  it('clears mustChangePassword and keeps the session valid (AC-09)', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'onboarding@toktickit.local' } });
    const { token } = await createSession(user.id);
    const cookie = `${TTK_SESSION_COOKIE}=${token}`;

    const response = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Cookie', cookie)
      .send({ currentPassword: 'DevPass123!', newPassword: 'NewStrong1!', confirmNewPassword: 'NewStrong1!' });

    expect(response.status).toBe(200);
    expect(response.body.mustChangePassword).toBe(false);

    const me = await request(app).get('/api/v1/me').set('Cookie', cookie);
    expect(me.status).toBe(200);

    const reloaded = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await verifyPassword('NewStrong1!', reloaded.passwordHash)).toBe(true);

    // Restore fixture state so other tests in this file (and reruns) see the original seed.
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword('DevPass123!'), mustChangePassword: true },
    });
  });

  it('rejects an incorrect current password and leaves mustChangePassword true (AC-10)', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'onboarding@toktickit.local' } });
    const { token } = await createSession(user.id);
    const cookie = `${TTK_SESSION_COOKIE}=${token}`;

    const response = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Cookie', cookie)
      .send({ currentPassword: 'WrongPass000!', newPassword: 'NewStrong1!', confirmNewPassword: 'NewStrong1!' });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('INVALID_CURRENT_PASSWORD');

    const reloaded = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(reloaded.mustChangePassword).toBe(true);
  });

  it('rejects a new password that fails the policy', async () => {
    const cookie = await loginCookieFor('requester@toktickit.local');
    const response = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Cookie', cookie)
      .send({ currentPassword: 'DevPass123!', newPassword: 'weak', confirmNewPassword: 'weak' });

    expect(response.status).toBe(422);
    expect(response.body.error.fieldErrors.length).toBeGreaterThan(0);
  });

  it('rejects a mismatched confirmation', async () => {
    const cookie = await loginCookieFor('requester@toktickit.local');
    const response = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Cookie', cookie)
      .send({ currentPassword: 'DevPass123!', newPassword: 'NewStrong1!', confirmNewPassword: 'Different1!' });

    expect(response.status).toBe(422);
    expect(response.body.error.fieldErrors.some((e: { field: string }) => e.field === 'confirmNewPassword')).toBe(true);
  });
});
