import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma';
import { createSession, TTK_SESSION_COOKIE } from '../../src/auth/session';

describe('mandatory password change gate (FR-05)', () => {
  it('blocks GET /api/v1/tickets for a user with mustChangePassword true', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'onboarding@toktickit.local' } });
    const { token } = await createSession(user.id);
    const cookie = `${TTK_SESSION_COOKIE}=${token}`;

    const response = await request(app).get('/api/v1/tickets').set('Cookie', cookie);
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  it('still allows /api/v1/me for the same user', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'onboarding@toktickit.local' } });
    const { token } = await createSession(user.id);
    const cookie = `${TTK_SESSION_COOKIE}=${token}`;

    const response = await request(app).get('/api/v1/me').set('Cookie', cookie);
    expect(response.status).toBe(200);
  });
});
