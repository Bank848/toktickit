import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';

describe('app', () => {
  it('boots and responds to requests', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(404);
  });
});
