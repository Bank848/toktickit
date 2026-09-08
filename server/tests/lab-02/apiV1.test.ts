import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';

describe('/api/v1 foundation', () => {
  it('Lab 1 aliases still respond identically', async () => {
    const health = await request(app).get('/api/health');
    expect(health.status).toBe(200);
    expect(health.body).toEqual({ status: 'ok', service: 'TokTickIT API' });

    const categories = await request(app).get('/api/categories');
    expect(categories.status).toBe(200);
    expect(categories.body).toHaveLength(4);
  });
});

describe('/api/v1/dev — removed in Lab 3 (FR-10)', () => {
  it('GET /api/v1/dev/requesters no longer exists', async () => {
    const response = await request(app).get('/api/v1/dev/requesters');
    expect(response.status).not.toBe(200);
  });

  it('POST /api/v1/dev/session no longer exists', async () => {
    const response = await request(app).post('/api/v1/dev/session').send({ userId: 'anything' });
    expect(response.status).not.toBe(200);
  });
});
