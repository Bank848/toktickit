import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { assertPasswordCurrent } from '../../src/middleware/assertPasswordCurrent';
import { errorEnvelope, correlationId } from '../../src/middleware/errorEnvelope';

function buildTestApp() {
  const app = express();
  app.use(correlationId);
  app.use((req, _res, next) => {
    req.user = {
      id: 'u1',
      email: 'x@x.test',
      displayName: 'X',
      role: 'REQUESTER',
      mustChangePassword: req.header('x-must-change') === 'true',
    };
    next();
  });
  app.use(assertPasswordCurrent);
  app.post('/auth/logout', (_req, res) => res.status(200).json({}));
  app.post('/auth/change-password', (_req, res) => res.status(200).json({}));
  app.get('/me', (_req, res) => res.status(200).json({}));
  app.get('/tickets', (_req, res) => res.status(200).json([]));
  app.use(errorEnvelope);
  return app;
}

describe('assertPasswordCurrent', () => {
  it('blocks a protected route when mustChangePassword is true', async () => {
    const response = await request(buildTestApp()).get('/tickets').set('x-must-change', 'true');
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  it('allows /me, /auth/logout, /auth/change-password while mustChangePassword is true', async () => {
    const app = buildTestApp();
    const me = await request(app).get('/me').set('x-must-change', 'true');
    const logout = await request(app).post('/auth/logout').set('x-must-change', 'true');
    const change = await request(app).post('/auth/change-password').set('x-must-change', 'true');
    expect(me.status).toBe(200);
    expect(logout.status).toBe(200);
    expect(change.status).toBe(200);
  });

  it('allows every route once mustChangePassword is false', async () => {
    const response = await request(buildTestApp()).get('/tickets').set('x-must-change', 'false');
    expect(response.status).toBe(200);
  });
});
