import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/auth/password';

describe('password hashing helper', () => {
  it('hashes a password to a bcrypt hash distinct from the plaintext', async () => {
    const hash = await hashPassword('Str0ng!Pass');
    expect(hash).not.toBe('Str0ng!Pass');
    expect(hash).toMatch(/^\$2[aby]\$/);
  });

  it('verifies a correct password against its hash', async () => {
    const hash = await hashPassword('Str0ng!Pass');
    expect(await verifyPassword('Str0ng!Pass', hash)).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('Str0ng!Pass');
    expect(await verifyPassword('WrongPass1!', hash)).toBe(false);
  });

  it('rejects any password against a null hash without throwing (A-04)', async () => {
    expect(await verifyPassword('anything', null)).toBe(false);
  });
});
