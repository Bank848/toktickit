import { describe, it, expect } from 'vitest';
import { validatePasswordPolicy } from '../../src/auth/passwordPolicy';

describe('validatePasswordPolicy', () => {
  it('accepts a password satisfying every rule', () => {
    expect(validatePasswordPolicy('Str0ng!Pass')).toEqual([]);
  });

  it('flags a password shorter than 8 characters', () => {
    const violations = validatePasswordPolicy('Sh0rt!');
    expect(violations.some((v) => /at least 8 characters/.test(v.message))).toBe(true);
  });

  it('flags a password missing an uppercase letter', () => {
    const violations = validatePasswordPolicy('weak1!weak');
    expect(violations.some((v) => /uppercase/.test(v.message))).toBe(true);
  });

  it('flags a password missing a lowercase letter', () => {
    const violations = validatePasswordPolicy('WEAK1!WEAK');
    expect(violations.some((v) => /lowercase/.test(v.message))).toBe(true);
  });

  it('flags a password missing a digit', () => {
    const violations = validatePasswordPolicy('Weak!Weak');
    expect(violations.some((v) => /digit/.test(v.message))).toBe(true);
  });

  it('flags a password missing a special character', () => {
    const violations = validatePasswordPolicy('Weak1Weak');
    expect(violations.some((v) => /special character/.test(v.message))).toBe(true);
  });
});
