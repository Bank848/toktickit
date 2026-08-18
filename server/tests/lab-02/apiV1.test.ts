import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';

describe('/api/v1 foundation', () => {
  it('GET /api/v1/me returns the identity resolved from the header', async () => {
    const response = await request(app)
      .get('/api/v1/me')
      .set('x-dev-user-email', 'requester@toktickit.local');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: expect.any(String),
      email: 'requester@toktickit.local',
      displayName: expect.any(String),
      role: 'REQUESTER',
    });
  });

  it('GET /api/v1/me returns 401 without identity', async () => {
    const response = await request(app).get('/api/v1/me');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('Lab 1 aliases still respond identically', async () => {
    const health = await request(app).get('/api/health');
    expect(health.status).toBe(200);
    expect(health.body).toEqual({ status: 'ok', service: 'TokTickIT API' });

    const categories = await request(app).get('/api/categories');
    expect(categories.status).toBe(200);
    expect(categories.body).toHaveLength(4);
  });
});
