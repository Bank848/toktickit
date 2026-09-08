import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma';
import { createSession, TTK_SESSION_COOKIE } from '../../src/auth/session';
import { truncateSessionTable } from '../helpers/resetDb';

describe('POST /api/v1/auth/logout', () => {
  it('invalidates the session so the same cookie cannot authenticate again (BR-09/AC-07)', async () => {
    await truncateSessionTable();
    const requester = await prisma.user.findUniqueOrThrow({
      where: { email: 'requester@toktickit.local' },
    });
    const { token } = await createSession(requester.id);
    const cookie = `${TTK_SESSION_COOKIE}=${token}`;

    const meBefore = await request(app).get('/api/v1/me').set('Cookie', cookie);
    expect(meBefore.status).toBe(200);

    const logoutResponse = await request(app).post('/api/v1/auth/logout').set('Cookie', cookie);
    expect(logoutResponse.status).toBe(200);

    const meAfter = await request(app).get('/api/v1/me').set('Cookie', cookie);
    expect(meAfter.status).toBe(401);
  });

  it('returns 401 without a session', async () => {
    const response = await request(app).post('/api/v1/auth/logout');
    expect(response.status).toBe(401);
  });
});
