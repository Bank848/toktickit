import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma';

describe('/api/v1 foundation', () => {
  it('GET /api/v1/me returns the identity resolved from the header', async () => {
    const requester = await prisma.user.findUniqueOrThrow({
      where: { email: 'requester@toktickit.local' },
    });

    const response = await request(app).get('/api/v1/me').set('x-dev-user-id', requester.id);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: requester.id,
      email: 'requester@toktickit.local',
      displayName: requester.displayName,
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

describe('/api/v1/dev — Development Requester Selection (D-18)', () => {
  it('GET /api/v1/dev/requesters lists only active Requesters, no identity required', async () => {
    const response = await request(app).get('/api/v1/dev/requesters');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThanOrEqual(4);
    for (const requester of response.body) {
      expect(requester).toEqual({ id: expect.any(String), email: expect.any(String), displayName: expect.any(String) });
    }

    const inactiveEmails = response.body.map((r: { email: string }) => r.email);
    expect(inactiveEmails).not.toContain('requester5-inactive@toktickit.local');
  });

  it('POST /api/v1/dev/session selects an active Requester', async () => {
    const requester = await prisma.user.findUniqueOrThrow({
      where: { email: 'requester@toktickit.local' },
    });

    const response = await request(app).post('/api/v1/dev/session').send({ userId: requester.id });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: requester.id,
      email: 'requester@toktickit.local',
      displayName: requester.displayName,
    });
  });

  it('POST /api/v1/dev/session 404s for an inactive Requester id, never a silent fallback', async () => {
    const inactive = await prisma.user.findUniqueOrThrow({
      where: { email: 'requester5-inactive@toktickit.local' },
    });

    const response = await request(app).post('/api/v1/dev/session').send({ userId: inactive.id });

    expect(response.status).toBe(404);
  });

  it('POST /api/v1/dev/session 404s for an unknown id', async () => {
    const response = await request(app)
      .post('/api/v1/dev/session')
      .send({ userId: '00000000-0000-0000-0000-000000000000' });

    expect(response.status).toBe(404);
  });

  it('POST /api/v1/dev/session 422s when userId is missing', async () => {
    const response = await request(app).post('/api/v1/dev/session').send({});

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });
});
