import bcrypt from 'bcrypt';

// BR-08: bcrypt, cost factor 10.
const SALT_ROUNDS = 10;

export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

// A-04: a null hash (no password ever set) always fails verification, never throws.
export async function verifyPassword(
  plainPassword: string,
  passwordHash: string | null,
): Promise<boolean> {
  if (!passwordHash) return false;
  return bcrypt.compare(plainPassword, passwordHash);
}
