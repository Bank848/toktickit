import { describe, it, expect, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { resolveCurrentUser, assertIdentitySeamBootGuard } from '../../src/auth/currentUser';
import { errorEnvelope, correlationId } from '../../src/middleware/errorEnvelope';

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

  it('resolves the seeded requester from the x-dev-user-email header', async () => {
    const response = await request(buildTestApp())
      .get('/whoami')
      .set('x-dev-user-email', 'requester@toktickit.local');

    expect(response.status).toBe(200);
    expect(response.body.email).toBe('requester@toktickit.local');
    expect(response.body.role).toBe('REQUESTER');
  });

  it('returns 401 for an unknown email', async () => {
    const response = await request(buildTestApp())
      .get('/whoami')
      .set('x-dev-user-email', 'nobody@toktickit.local');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns 401 when no identity header or env fallback is present', async () => {
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
