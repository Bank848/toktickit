import { describe, it, expect, vi, afterEach } from 'vitest';
import { validateCreateActionTakenRequest } from '../../src/validators/actionTakenRequest';

describe('validateCreateActionTakenRequest', () => {
  afterEach(() => vi.useRealTimers());

  const VALID = {
    actionAt: '2026-09-20T10:00:00.000Z',
    description: 'Replaced the failing network card and confirmed connectivity.',
    result: 'RESOLVED',
    followUpRequired: false,
  };

  it('accepts a valid minimal request', () => {
    const result = validateCreateActionTakenRequest(VALID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.result).toBe('RESOLVED');
      expect(result.value.followUpNote).toBeNull();
    }
  });

  it('rejects a result value outside the enum (422)', () => {
    const result = validateCreateActionTakenRequest({ ...VALID, result: 'FIXED' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.field === 'result')).toBe(true);
  });

  it('rejects description shorter than 1 char or longer than 2000 (BR field length)', () => {
    expect(validateCreateActionTakenRequest({ ...VALID, description: '' }).ok).toBe(false);
    expect(validateCreateActionTakenRequest({ ...VALID, description: 'x'.repeat(2001) }).ok).toBe(false);
  });

  it('requires a non-empty followUpNote when followUpRequired is true (BR-05/AC-06)', () => {
    const result = validateCreateActionTakenRequest({ ...VALID, followUpRequired: true, followUpNote: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.field === 'followUpNote')).toBe(true);
  });

  it('accepts followUpRequired true with a non-empty note', () => {
    const result = validateCreateActionTakenRequest({
      ...VALID, followUpRequired: true, followUpNote: 'Requester needs to restart their machine.',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.followUpNote).toBe('Requester needs to restart their machine.');
  });

  it('clears followUpNote to null when followUpRequired is false, even if the body sends text (BR-05/AC-07)', () => {
    const result = validateCreateActionTakenRequest({
      ...VALID, followUpRequired: false, followUpNote: 'stale text the client should not have sent',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.followUpNote).toBeNull();
  });

  it('rejects an actionAt timestamp in the future (BR-07)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-23T12:00:00.000Z'));
    const result = validateCreateActionTakenRequest({ ...VALID, actionAt: '2026-09-23T12:00:01.000Z' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.field === 'actionAt')).toBe(true);
  });

  it('accepts an actionAt timestamp exactly at the current instant (boundary)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-23T12:00:00.000Z'));
    const result = validateCreateActionTakenRequest({ ...VALID, actionAt: '2026-09-23T12:00:00.000Z' });
    expect(result.ok).toBe(true);
  });

  it('rejects an unparseable actionAt', () => {
    const result = validateCreateActionTakenRequest({ ...VALID, actionAt: 'not-a-date' });
    expect(result.ok).toBe(false);
  });

  it('rejects attachmentNotes longer than 500 chars', () => {
    const result = validateCreateActionTakenRequest({ ...VALID, attachmentNotes: 'x'.repeat(501) });
    expect(result.ok).toBe(false);
  });

  it('accepts attachmentNotes omitted (optional field, defaults to null)', () => {
    const result = validateCreateActionTakenRequest(VALID);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.attachmentNotes).toBeNull();
  });
});
