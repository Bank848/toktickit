import { FieldError } from '../middleware/errorEnvelope';

export type { FieldError };

export interface ValidatedCreateCommentRequest {
  body: string;
  problemAppearsResolved: boolean;
}

type ValidationResult =
  | { ok: true; value: ValidatedCreateCommentRequest }
  | { ok: false; errors: FieldError[] };

export function validateCreateCommentRequest(body: Record<string, unknown>): ValidationResult {
  const errors: FieldError[] = [];

  const rawBody = typeof body.body === 'string' ? body.body.trim() : '';
  if (typeof body.body !== 'string' || rawBody.length < 1 || rawBody.length > 2000) {
    errors.push({ field: 'body', message: 'body is required, 1-2000 characters after trim' });
  }

  let problemAppearsResolved = false;
  if (body.problemAppearsResolved !== undefined) {
    if (typeof body.problemAppearsResolved !== 'boolean') {
      errors.push({ field: 'problemAppearsResolved', message: 'problemAppearsResolved must be a boolean' });
    } else {
      problemAppearsResolved = body.problemAppearsResolved;
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: { body: rawBody, problemAppearsResolved } };
}
