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

describe('PATCH /api/v1/admin/users/:id', () => {
  let adminCookie: string;
  let adminId: string;
  let targetId: string;

  beforeAll(async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@toktickit.local' } });
    adminId = admin.id;
    adminCookie = await createSessionCookieFor(admin.id);
  });

  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { email: 'edit-target@toktickit.local' } });
    const target = await prisma.user.create({
      data: {
        email: 'edit-target@toktickit.local',
        displayName: 'Edit Target',
        role: 'REQUESTER',
        isActive: true,
      },
    });
    targetId = target.id;
  });

  it('updates displayName/email/role/isActive', async () => {
    const response = await request(app)
      .patch(`/api/v1/admin/users/${targetId}`)
      .set('Cookie', adminCookie)
      .send({ displayName: 'Renamed', email: 'edit-target@toktickit.local', role: 'IT_STAFF', isActive: false });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ displayName: 'Renamed', role: 'IT_STAFF', isActive: false });
  });

  it('rejects an edit that reuses another user\'s email with 409', async () => {
    const response = await request(app)
      .patch(`/api/v1/admin/users/${targetId}`)
      .set('Cookie', adminCookie)
      .send({ displayName: 'Edit Target', email: 'admin@toktickit.local', role: 'REQUESTER', isActive: true });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('rejects an Administrator deactivating their own account with 409 SELF_DEACTIVATION_BLOCKED', async () => {
    const response = await request(app)
      .patch(`/api/v1/admin/users/${adminId}`)
      .set('Cookie', adminCookie)
      .send({ displayName: 'System Admin', email: 'admin@toktickit.local', role: 'ADMINISTRATOR', isActive: false });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('SELF_DEACTIVATION_BLOCKED');
    const stillActive = await prisma.user.findUniqueOrThrow({ where: { id: adminId } });
    expect(stillActive.isActive).toBe(true);
  });

  it('rejects deactivating the last active Administrator with 409 LAST_ADMIN_PROTECTED (role-change branch, API-33)', async () => {
    // Seed guarantees exactly one active ADMINISTRATOR at this point in the suite unless another
    // test created a second one; make it explicit by deactivating any other admins first.
    await prisma.user.updateMany({
      where: { role: 'ADMINISTRATOR', id: { not: adminId } },
      data: { isActive: false },
    });

    const response = await request(app)
      .patch(`/api/v1/admin/users/${adminId}`)
      .set('Cookie', adminCookie)
      .send({ displayName: 'System Admin', email: 'admin@toktickit.local', role: 'REQUESTER', isActive: true });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('LAST_ADMIN_PROTECTED');
  });

  it('rejects deactivating (isActive: false, role unchanged) the last active Administrator, keeping the account active (deactivate branch, API-33/BR-28)', async () => {
    // api-spec.md #29's ordered checks put self-deactivation (BR-27) strictly before last-admin
    // protection (BR-28), and BR-27 has no last-admin carve-out. Combined with BR-11 (isActive is
    // re-checked live on every request, so the acting Administrator making this call must
    // currently be active themselves), the pure "isActive: false, role unchanged" branch of
    // BR-28 is unreachable for a non-self target: any active, authenticated Administrator other
    // than the target is itself counted as an "other active Administrator", so the last-admin
    // guard only ever finds otherActiveAdmins === 0 when target === actor -- and that case is
    // always intercepted first by BR-27's unconditional self-deactivation block. So this request
    // correctly surfaces SELF_DEACTIVATION_BLOCKED rather than LAST_ADMIN_PROTECTED; what BR-28
    // actually guarantees here -- the account/role staying unchanged -- is still verified below.
    await prisma.user.updateMany({
      where: { role: 'ADMINISTRATOR', id: { not: adminId } },
      data: { isActive: false },
    });

    const response = await request(app)
      .patch(`/api/v1/admin/users/${adminId}`)
      .set('Cookie', adminCookie)
      .send({ displayName: 'System Admin', email: 'admin@toktickit.local', role: 'ADMINISTRATOR', isActive: false });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('SELF_DEACTIVATION_BLOCKED');
    const stillActive = await prisma.user.findUniqueOrThrow({ where: { id: adminId } });
    expect(stillActive.isActive).toBe(true);
    expect(stillActive.role).toBe('ADMINISTRATOR');
  });

  it('normalizes email to lowercase before storing on edit too (UNIT-04)', async () => {
    const response = await request(app)
      .patch(`/api/v1/admin/users/${targetId}`)
      .set('Cookie', adminCookie)
      .send({ displayName: 'Edit Target', email: 'Edit-Target@TokTickIT.Local', role: 'REQUESTER', isActive: true });

    expect(response.status).toBe(200);
    expect(response.body.email).toBe('edit-target@toktickit.local');
  });

  it('deactivating a non-Administrator user only sets isActive: false; the row is never hard-deleted (BR-29, API-35)', async () => {
    const response = await request(app)
      .patch(`/api/v1/admin/users/${targetId}`)
      .set('Cookie', adminCookie)
      .send({ displayName: 'Edit Target', email: 'edit-target@toktickit.local', role: 'REQUESTER', isActive: false });

    expect(response.status).toBe(200);
    expect(response.body.isActive).toBe(false);

    // No DELETE route exists for this resource at all -- deactivation is the only removal path.
    const deleteAttempt = await request(app)
      .delete(`/api/v1/admin/users/${targetId}`)
      .set('Cookie', adminCookie);
    expect(deleteAttempt.status).toBe(404);

    // The deactivated row is still present (and still listed), never hard-deleted.
    const stillPresent = await prisma.user.findUnique({ where: { id: targetId } });
    expect(stillPresent).not.toBeNull();
    expect(stillPresent?.isActive).toBe(false);

    const listResponse = await request(app).get('/api/v1/admin/users').set('Cookie', adminCookie);
    expect(listResponse.body.some((u: { id: string }) => u.id === targetId)).toBe(true);
  });

  it('returns 404 for a nonexistent user id', async () => {
    // displayName must independently satisfy validateUpdateUserRequest's 2-100 char rule (a
    // single character fails validation with 422 before the 404 not-found check is ever reached).
    const response = await request(app)
      .patch('/api/v1/admin/users/00000000-0000-0000-0000-000000000000')
      .set('Cookie', adminCookie)
      .send({ displayName: 'Nonexistent', email: 'x@toktickit.local', role: 'REQUESTER', isActive: true });

    expect(response.status).toBe(404);
  });
});
