import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma';
import { TTK_SESSION_COOKIE, hashToken } from '../../src/auth/session';

describe('POST /api/v1/auth/login', () => {
  it('succeeds for correct credentials and sets an httpOnly ttk_session cookie (AC-01)', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'requester@toktickit.local', password: 'DevPass123!' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      email: 'requester@toktickit.local',
      role: 'REQUESTER',
      mustChangePassword: false,
    });

    const setCookie = response.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    expect(cookieHeader).toContain(`${TTK_SESSION_COOKIE}=`);
    expect(cookieHeader.toLowerCase()).toContain('httponly');

    const token = cookieHeader.split(';')[0].split('=')[1];
    const stored = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) } });
    expect(stored).not.toBeNull();
  });

  it('is case-insensitive on email (A-05)', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'REQUESTER@toktickit.local', password: 'DevPass123!' });
    expect(response.status).toBe(200);
  });

  it('returns identical 401 INVALID_CREDENTIALS for an unknown email (BR-06/AC-05)', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@toktickit.local', password: 'Whatever1!' });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns identical 401 INVALID_CREDENTIALS for a known email with the wrong password (BR-06/AC-05)', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'requester@toktickit.local', password: 'WrongPassword1!' });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns distinct 403 ACCOUNT_DEACTIVATED for a deactivated user with correct credentials (BR-07/AC-06)', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'requester5-inactive@toktickit.local', password: 'DevPass123!' });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('ACCOUNT_DEACTIVATED');
  });

  it('returns 422 for a missing email or password', async () => {
    const response = await request(app).post('/api/v1/auth/login').send({ email: '' });
    expect(response.status).toBe(422);
    expect(response.body.error.fieldErrors.length).toBeGreaterThan(0);
  });
});
