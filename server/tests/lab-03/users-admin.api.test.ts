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

describe('POST /api/v1/admin/users', () => {
  let adminCookie: string;

  beforeAll(async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@toktickit.local' } });
    adminCookie = await createSessionCookieFor(admin.id);
  });

  const validPayload = {
    displayName: 'Test Newbie',
    email: 'newbie@toktickit.local',
    role: 'REQUESTER',
    isActive: true,
    initialPassword: 'Str0ng!Pass',
  };

  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { email: validPayload.email } });
  });

  it('creates a user with mustChangePassword forced true, ignoring any client-supplied value', async () => {
    const response = await request(app)
      .post('/api/v1/admin/users')
      .set('Cookie', adminCookie)
      .send({ ...validPayload, mustChangePassword: false });

    expect(response.status).toBe(201);
    expect(response.body.mustChangePassword).toBe(true);
    expect(response.body.email).toBe(validPayload.email);
    expect(response.body).not.toHaveProperty('passwordHash');

    const stored = await prisma.user.findUniqueOrThrow({ where: { email: validPayload.email } });
    expect(stored.passwordHash).not.toBe(validPayload.initialPassword);
    expect(stored.mustChangePassword).toBe(true);
  });

  it('normalizes email to lowercase before storing', async () => {
    const response = await request(app)
      .post('/api/v1/admin/users')
      .set('Cookie', adminCookie)
      .send({ ...validPayload, email: 'NewBie@TokTickIT.Local' });

    expect(response.status).toBe(201);
    expect(response.body.email).toBe('newbie@toktickit.local');
  });

  it('rejects a duplicate email with 409 EMAIL_ALREADY_EXISTS', async () => {
    const response = await request(app)
      .post('/api/v1/admin/users')
      .set('Cookie', adminCookie)
      .send({ ...validPayload, email: 'admin@toktickit.local' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('rejects a password that fails the policy with 422', async () => {
    const response = await request(app)
      .post('/api/v1/admin/users')
      .set('Cookie', adminCookie)
      .send({ ...validPayload, initialPassword: 'weak' });

    expect(response.status).toBe(422);
    expect(response.body.error.fieldErrors.some((e: { field: string }) => e.field === 'initialPassword')).toBe(true);
  });

  it('rejects a non-Administrator caller with 403', async () => {
    const staff = await prisma.user.findUniqueOrThrow({ where: { email: 'itstaff@toktickit.local' } });
    const cookie = await createSessionCookieFor(staff.id);
    const response = await request(app).post('/api/v1/admin/users').set('Cookie', cookie).send(validPayload);
    expect(response.status).toBe(403);
  });
});
