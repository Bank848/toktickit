import { describe, it, expect } from 'vitest';
import { validateCreateCommentRequest } from '../../src/validators/createCommentRequest';

describe('validateCreateCommentRequest', () => {
  it('accepts a trimmed body with no problemAppearsResolved flag, defaulting it to false', () => {
    const result = validateCreateCommentRequest({ body: '  Still broken.  ' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ body: 'Still broken.', problemAppearsResolved: false });
    }
  });

  it('accepts problemAppearsResolved: true', () => {
    const result = validateCreateCommentRequest({ body: 'Looks fixed now', problemAppearsResolved: true });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.problemAppearsResolved).toBe(true);
  });

  it('rejects an empty or whitespace-only body (BR-21)', () => {
    expect(validateCreateCommentRequest({ body: '' }).ok).toBe(false);
    expect(validateCreateCommentRequest({ body: '   ' }).ok).toBe(false);
    expect(validateCreateCommentRequest({}).ok).toBe(false);
  });

  it('rejects a body over 2000 characters after trim', () => {
    const result = validateCreateCommentRequest({ body: 'x'.repeat(2001) });
    expect(result.ok).toBe(false);
  });

  it('rejects a non-boolean problemAppearsResolved', () => {
    const result = validateCreateCommentRequest({ body: 'ok', problemAppearsResolved: 'yes' });
    expect(result.ok).toBe(false);
  });
});
