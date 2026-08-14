import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';

describe('GET /api/categories', () => {
  it('returns the four seeded categories', async () => {
    const response = await request(app).get('/api/categories');

    expect(response.status).toBe(200);
    const names = response.body.map((category: { name: string }) => category.name);
    expect(names).toEqual(['Account and Access', 'Hardware', 'Software', 'Network']);
  });
});
