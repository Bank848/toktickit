export interface PasswordPolicyViolation {
  field: string;
  message: string;
}

const MIN_LENGTH = 8;

// specification.md §4.1: >=8 chars, at least one upper, one lower, one digit, one special char.
export function validatePasswordPolicy(
  password: string,
  field = 'newPassword',
): PasswordPolicyViolation[] {
  const violations: PasswordPolicyViolation[] = [];
  if (password.length < MIN_LENGTH) {
    violations.push({ field, message: `Password must be at least ${MIN_LENGTH} characters` });
  }
  if (!/[A-Z]/.test(password)) {
    violations.push({ field, message: 'Password must include at least one uppercase letter' });
  }
  if (!/[a-z]/.test(password)) {
    violations.push({ field, message: 'Password must include at least one lowercase letter' });
  }
  if (!/[0-9]/.test(password)) {
    violations.push({ field, message: 'Password must include at least one digit' });
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    violations.push({ field, message: 'Password must include at least one special character' });
  }
  return violations;
}
