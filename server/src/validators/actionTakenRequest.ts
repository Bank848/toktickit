import { FieldError } from '../middleware/errorEnvelope';

export type { FieldError };

const RESULTS = ['RESOLVED', 'ESCALATED', 'NO_ACTION_NEEDED', 'PENDING_FOLLOW_UP'] as const;
type ActionResult = (typeof RESULTS)[number];

export interface ValidatedActionTakenRequest {
  actionAt: Date;
  description: string;
  result: ActionResult;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
}

type ValidationResult =
  | { ok: true; value: ValidatedActionTakenRequest }
  | { ok: false; errors: FieldError[] };

function validate(body: Record<string, unknown>): ValidationResult {
  const errors: FieldError[] = [];

  let actionAt: Date | null = null;
  if (typeof body.actionAt !== 'string') {
    errors.push({ field: 'actionAt', message: 'actionAt is required and must be an ISO 8601 timestamp' });
  } else {
    const parsed = new Date(body.actionAt);
    if (Number.isNaN(parsed.getTime())) {
      errors.push({ field: 'actionAt', message: 'actionAt must be a valid ISO 8601 timestamp' });
    } else if (parsed.getTime() > Date.now()) {
      // BR-07: may not be set in the future. A same-instant value is allowed (boundary is
      // inclusive) -- only a strictly-later timestamp is rejected.
      errors.push({ field: 'actionAt', message: 'actionAt may not be in the future' });
    } else {
      actionAt = parsed;
    }
  }

  const rawDescription = typeof body.description === 'string' ? body.description.trim() : '';
  if (typeof body.description !== 'string' || rawDescription.length < 1 || rawDescription.length > 2000) {
    errors.push({ field: 'description', message: 'description is required, 1-2000 characters' });
  }

  const result = body.result;
  if (typeof result !== 'string' || !(RESULTS as readonly string[]).includes(result)) {
    errors.push({ field: 'result', message: `result must be one of ${RESULTS.join(', ')}` });
  }

  const followUpRequired = body.followUpRequired === true;
  if (body.followUpRequired !== undefined && typeof body.followUpRequired !== 'boolean') {
    errors.push({ field: 'followUpRequired', message: 'followUpRequired must be a boolean' });
  }

  // BR-05: required and non-empty when true, cleared to empty (null, stored) when false --
  // computed after followUpRequired so a bad followUpRequired doesn't also produce a
  // misleading followUpNote error.
  let followUpNote: string | null = null;
  if (followUpRequired) {
    const rawNote = typeof body.followUpNote === 'string' ? body.followUpNote.trim() : '';
    if (rawNote.length < 1 || rawNote.length > 1000) {
      errors.push({ field: 'followUpNote', message: 'followUpNote is required and non-empty when followUpRequired is true' });
    } else {
      followUpNote = rawNote;
    }
  }

  let attachmentNotes: string | null = null;
  if (body.attachmentNotes !== undefined && body.attachmentNotes !== null) {
    const raw = typeof body.attachmentNotes === 'string' ? body.attachmentNotes.trim() : '';
    if (typeof body.attachmentNotes !== 'string' || raw.length > 500) {
      errors.push({ field: 'attachmentNotes', message: 'attachmentNotes must be 500 characters or fewer' });
    } else {
      attachmentNotes = raw.length > 0 ? raw : null;
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      actionAt: actionAt as Date,
      description: rawDescription,
      result: result as ActionResult,
      followUpRequired,
      followUpNote,
      attachmentNotes,
    },
  };
}

export function validateCreateActionTakenRequest(body: Record<string, unknown>): ValidationResult {
  return validate(body);
}

export function validateUpdateActionTakenRequest(body: Record<string, unknown>): ValidationResult {
  return validate(body);
}
