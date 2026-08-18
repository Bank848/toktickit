import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';

describe('reference data endpoints', () => {
  it('GET /api/v1/categories returns only active categories, requires identity', async () => {
    const unauth = await request(app).get('/api/v1/categories');
    expect(unauth.status).toBe(401);

    const response = await request(app)
      .get('/api/v1/categories')
      .set('x-dev-user-email', 'requester@toktickit.local');
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(4);
    for (const category of response.body) {
      expect(category).toHaveProperty('id');
      expect(category).toHaveProperty('name');
      expect(category).not.toHaveProperty('storageKey');
    }
  });

  it('GET /api/v1/related-systems returns 401 without identity', async () => {
    const response = await request(app).get('/api/v1/related-systems');
    expect(response.status).toBe(401);
  });

  it('GET /api/v1/related-systems returns only the 5 active rows, not the inactive one', async () => {
    const response = await request(app)
      .get('/api/v1/related-systems')
      .set('x-dev-user-email', 'requester@toktickit.local');
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(5);
    expect(response.body.map((s: { code: string }) => s.code)).not.toContain('LEGACY_FS');
  });
});
