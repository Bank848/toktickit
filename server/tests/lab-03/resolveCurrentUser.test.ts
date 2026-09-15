import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { resolveCurrentUser } from '../../src/auth/currentUser';
import { errorEnvelope, correlationId } from '../../src/middleware/errorEnvelope';
import { prisma } from '../../src/prisma';
import { createSession, TTK_SESSION_COOKIE } from '../../src/auth/session';
import { truncateSessionTable } from '../helpers/resetDb';

function buildTestApp() {
  const app = express();
  app.use(cookieParser());
  app.use(correlationId);
  app.get('/whoami', resolveCurrentUser, (req, res) => {
    res.status(200).json({
      id: req.user!.id,
      role: req.user!.role,
      mustChangePassword: req.user!.mustChangePassword,
    });
  });
  app.use(errorEnvelope);
  return app;
}

describe('resolveCurrentUser', () => {
  beforeEach(async () => {
    await truncateSessionTable();
  });

  it('resolves the user from a valid session cookie', async () => {
    const requester = await prisma.user.findUniqueOrThrow({
      where: { email: 'requester@toktickit.local' },
    });
    const { token } = await createSession(requester.id);

    const response = await request(buildTestApp())
      .get('/whoami')
      .set('Cookie', `${TTK_SESSION_COOKIE}=${token}`);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(requester.id);
    expect(response.body.role).toBe('REQUESTER');
  });

  it('returns 401 when no cookie is present', async () => {
    const response = await request(buildTestApp()).get('/whoami');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns 401 for an unknown token', async () => {
    const response = await request(buildTestApp())
      .get('/whoami')
      .set('Cookie', `${TTK_SESSION_COOKIE}=not-a-real-token`);
    expect(response.status).toBe(401);
  });

  it('returns 401 for an expired session (AC-08)', async () => {
    const requester = await prisma.user.findUniqueOrThrow({
      where: { email: 'requester@toktickit.local' },
    });
    const { token } = await createSession(requester.id);
    await prisma.session.updateMany({
      where: { userId: requester.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const response = await request(buildTestApp())
      .get('/whoami')
      .set('Cookie', `${TTK_SESSION_COOKIE}=${token}`);
    expect(response.status).toBe(401);
  });

  it('returns 401 for a revoked session (AC-08)', async () => {
    const requester = await prisma.user.findUniqueOrThrow({
      where: { email: 'requester@toktickit.local' },
    });
    const { token } = await createSession(requester.id);
    await prisma.session.updateMany({
      where: { userId: requester.id },
      data: { revokedAt: new Date() },
    });

    const response = await request(buildTestApp())
      .get('/whoami')
      .set('Cookie', `${TTK_SESSION_COOKIE}=${token}`);
    expect(response.status).toBe(401);
  });

  it('returns 401 when the user has been deactivated mid-session (BR-11 live re-check)', async () => {
    const inactive = await prisma.user.findUniqueOrThrow({
      where: { email: 'requester5-inactive@toktickit.local' },
    });
    const { token } = await createSession(inactive.id);

    const response = await request(buildTestApp())
      .get('/whoami')
      .set('Cookie', `${TTK_SESSION_COOKIE}=${token}`);
    expect(response.status).toBe(401);
  });

  it('surfaces mustChangePassword on the resolved identity', async () => {
    const mustChange = await prisma.user.findUniqueOrThrow({
      where: { email: 'onboarding@toktickit.local' },
    });
    const { token } = await createSession(mustChange.id);

    const response = await request(buildTestApp())
      .get('/whoami')
      .set('Cookie', `${TTK_SESSION_COOKIE}=${token}`);
    expect(response.status).toBe(200);
    expect(response.body.mustChangePassword).toBe(true);
  });
});
