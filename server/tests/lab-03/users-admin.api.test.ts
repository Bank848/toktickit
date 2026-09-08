import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma';
import { createSessionCookieFor } from '../helpers/session';

describe('GET /api/v1/admin/users', () => {
  let adminCookie: string;
  let staffCookie: string;
  let requesterCookie: string;

  beforeAll(async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@toktickit.local' } });
    const staff = await prisma.user.findUniqueOrThrow({ where: { email: 'itstaff@toktickit.local' } });
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: 'requester@toktickit.local' } });
    adminCookie = await createSessionCookieFor(admin.id);
    staffCookie = await createSessionCookieFor(staff.id);
    requesterCookie = await createSessionCookieFor(requester.id);
  });

  it('returns 403 FORBIDDEN_ROLE for a non-Administrator caller', async () => {
    const response = await request(app).get('/api/v1/admin/users').set('Cookie', staffCookie);
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN_ROLE');
  });

  it('returns 401 with no session cookie at all', async () => {
    const response = await request(app).get('/api/v1/admin/users');
    expect(response.status).toBe(401);
  });

  it('lists every user for an Administrator caller, with Name/Email/Role/Status fields', async () => {
    const response = await request(app).get('/api/v1/admin/users').set('Cookie', adminCookie);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    const admin = response.body.find((u: { email: string }) => u.email === 'admin@toktickit.local');
    expect(admin).toMatchObject({
      displayName: expect.any(String),
      email: 'admin@toktickit.local',
      role: 'ADMINISTRATOR',
      isActive: true,
    });
    expect(admin).toHaveProperty('mustChangePassword');
    expect(admin).toHaveProperty('createdAt');
  });

  it('filters by role', async () => {
    const response = await request(app)
      .get('/api/v1/admin/users')
      .query({ role: 'IT_STAFF' })
      .set('Cookie', adminCookie);
    expect(response.status).toBe(200);
    expect(response.body.every((u: { role: string }) => u.role === 'IT_STAFF')).toBe(true);
  });

  it('searches by name or email, case-insensitively', async () => {
    const response = await request(app)
      .get('/api/v1/admin/users')
      .query({ q: 'ADMIN@TOKTICKIT' })
      .set('Cookie', adminCookie);
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].email).toBe('admin@toktickit.local');
  });

  it('rejects an invalid role filter value with 422', async () => {
    const response = await request(app)
      .get('/api/v1/admin/users')
      .query({ role: 'NOT_A_ROLE' })
      .set('Cookie', adminCookie);
    expect(response.status).toBe(422);
  });

  it('requesterCookie is unused directly here but proves the fixture loads', () => {
    expect(requesterCookie).toBeTruthy();
  });
});
