import { describe, it, expect, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { resolveCurrentUser, assertIdentitySeamBootGuard } from '../../src/auth/currentUser';
import { errorEnvelope, correlationId } from '../../src/middleware/errorEnvelope';
import { prisma } from '../../src/prisma';

function buildTestApp() {
  const app = express();
  app.use(correlationId);
  app.get('/whoami', resolveCurrentUser, (req, res) => {
    res.status(200).json({ id: req.user!.id, email: req.user!.email, role: req.user!.role });
  });
  app.use(errorEnvelope);
  return app;
}

describe('resolveCurrentUser', () => {
  afterEach(() => {
    delete process.env.ALLOW_DEV_IDENTITY;
    vi.unstubAllEnvs();
  });

  it('resolves the seeded requester from the x-dev-user-id header', async () => {
    const requester = await prisma.user.findUniqueOrThrow({
      where: { email: 'requester@toktickit.local' },
    });

    const response = await request(buildTestApp()).get('/whoami').set('x-dev-user-id', requester.id);

    expect(response.status).toBe(200);
    expect(response.body.email).toBe('requester@toktickit.local');
    expect(response.body.role).toBe('REQUESTER');
  });

  it('returns 401 for an unknown id', async () => {
    const response = await request(buildTestApp())
      .get('/whoami')
      .set('x-dev-user-id', '00000000-0000-0000-0000-000000000000');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns 401 for an inactive requester', async () => {
    const inactive = await prisma.user.findUniqueOrThrow({
      where: { email: 'requester5-inactive@toktickit.local' },
    });

    const response = await request(buildTestApp()).get('/whoami').set('x-dev-user-id', inactive.id);

    expect(response.status).toBe(401);
  });

  it('returns 401 for a non-Requester id (IT Staff, Administrator)', async () => {
    const itStaff = await prisma.user.findUniqueOrThrow({ where: { email: 'itstaff@toktickit.local' } });

    const response = await request(buildTestApp()).get('/whoami').set('x-dev-user-id', itStaff.id);

    expect(response.status).toBe(401);
  });

  it('returns 401 when no identity header is present, never a silent default', async () => {
    const response = await request(buildTestApp()).get('/whoami');
    expect(response.status).toBe(401);
  });
});

describe('assertIdentitySeamBootGuard', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('throws in production without ALLOW_DEV_IDENTITY', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ALLOW_DEV_IDENTITY', '');
    expect(() => assertIdentitySeamBootGuard()).toThrow(/no production identity provider/i);
  });

  it('does not throw in production when ALLOW_DEV_IDENTITY=true', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ALLOW_DEV_IDENTITY', 'true');
    expect(() => assertIdentitySeamBootGuard()).not.toThrow();
  });

  it('does not throw outside production', () => {
    vi.stubEnv('NODE_ENV', 'test');
    expect(() => assertIdentitySeamBootGuard()).not.toThrow();
  });
});
