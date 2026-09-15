import request from 'supertest';
import { app } from '../../src/app';
import { DEV_SEED_PASSWORD } from './staffFixtures';

export async function loginAs(email: string, password: string = DEV_SEED_PASSWORD): Promise<string> {
  const response = await request(app).post('/api/v1/auth/login').send({ email, password });
  if (response.status !== 200) {
    throw new Error(`loginAs(${email}) failed with ${response.status}: ${JSON.stringify(response.body)}`);
  }
  const setCookie = response.headers['set-cookie'];
  if (!setCookie || setCookie.length === 0) {
    throw new Error(`loginAs(${email}) succeeded but returned no Set-Cookie header`);
  }
  return Array.isArray(setCookie) ? setCookie[0] : setCookie;
}
