import { FieldError } from '../middleware/errorEnvelope';
import { validatePasswordPolicy } from '../auth/passwordPolicy';

export interface ValidatedSetInitialPasswordRequest {
  newInitialPassword: string;
}

type Result =
  | { ok: true; value: ValidatedSetInitialPasswordRequest }
  | { ok: false; errors: FieldError[] };

export function validateSetInitialPasswordRequest(body: Record<string, unknown>): Result {
  // #36's validatePasswordPolicy (server/src/auth/passwordPolicy.ts) requires password to
  // already be a string -- it has no built-in "is required" check for non-string input --
  // so that case is handled here before delegating the actual policy rules to it (same
  // pattern as createUserRequest.ts).
  if (typeof body.newInitialPassword !== 'string') {
    return { ok: false, errors: [{ field: 'newInitialPassword', message: 'newInitialPassword is required' }] };
  }

  const errors = validatePasswordPolicy(body.newInitialPassword, 'newInitialPassword');
  if (errors.length > 0) return { ok: false, errors };

  return { ok: true, value: { newInitialPassword: body.newInitialPassword } };
}
