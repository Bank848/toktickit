import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { loginAs } from '../helpers/auth';
import { SEED_EMAILS } from '../helpers/staffFixtures';

describe('GET /api/v1/staff/assignable-owners', () => {
  let staffCookie: string;
  let requesterCookie: string;

  beforeAll(async () => {
    staffCookie = await loginAs(SEED_EMAILS.itStaff1);
    requesterCookie = await loginAs(SEED_EMAILS.requester);
  });

  it('returns active IT_STAFF and ADMINISTRATOR users, excluding inactive and Requester rows', async () => {
    const response = await request(app).get('/api/v1/staff/assignable-owners').set('Cookie', staffCookie);
    expect(response.status).toBe(200);
    const roles = response.body.map((u: { role: string }) => u.role);
    expect(roles.every((r: string) => r === 'IT_STAFF' || r === 'ADMINISTRATOR')).toBe(true);
    const emails = response.body.map((u: { displayName: string }) => u.displayName);
    expect(emails).not.toContain('IT Support (inactive)');
  });

  it('rejects a Requester caller with 403', async () => {
    const response = await request(app).get('/api/v1/staff/assignable-owners').set('Cookie', requesterCookie);
    expect(response.status).toBe(403);
  });
});
