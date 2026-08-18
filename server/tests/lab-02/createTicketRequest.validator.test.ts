import { describe, it, expect } from 'vitest';
import { validateCreateTicketRequest } from '../../src/validators/createTicketRequest';

const validBody = {
  summary: 'Laptop will not turn on',
  description: 'Pressed the power button several times, no lights or fan noise at all.',
  categoryId: 1,
  requestedPriority: 'MEDIUM',
};

describe('validateCreateTicketRequest', () => {
  it('accepts a fully valid body', () => {
    const result = validateCreateTicketRequest(validBody);
    expect(result.ok).toBe(true);
  });

  it('rejects a 4-character summary', () => {
    const result = validateCreateTicketRequest({ ...validBody, summary: 'abcd' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.map((e) => e.field)).toContain('summary');
  });

  it('accepts a 5-character summary (lower boundary)', () => {
    const result = validateCreateTicketRequest({ ...validBody, summary: 'abcde' });
    expect(result.ok).toBe(true);
  });

  it('accepts a 150-character summary (upper boundary)', () => {
    const result = validateCreateTicketRequest({ ...validBody, summary: 'a'.repeat(150) });
    expect(result.ok).toBe(true);
  });

  it('rejects a 151-character summary', () => {
    const result = validateCreateTicketRequest({ ...validBody, summary: 'a'.repeat(151) });
    expect(result.ok).toBe(false);
  });

  it('rejects a 9-character description', () => {
    const result = validateCreateTicketRequest({ ...validBody, description: 'a'.repeat(9) });
    expect(result.ok).toBe(false);
  });

  it('accepts a 10-character description (lower boundary)', () => {
    const result = validateCreateTicketRequest({ ...validBody, description: 'a'.repeat(10) });
    expect(result.ok).toBe(true);
  });

  it('rejects a 5001-character description', () => {
    const result = validateCreateTicketRequest({ ...validBody, description: 'a'.repeat(5001) });
    expect(result.ok).toBe(false);
  });

  it('rejects a blank-after-trim summary', () => {
    const result = validateCreateTicketRequest({ ...validBody, summary: '     ' });
    expect(result.ok).toBe(false);
  });

  it('rejects a missing categoryId', () => {
    const { categoryId, ...rest } = validBody;
    const result = validateCreateTicketRequest(rest);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.map((e) => e.field)).toContain('categoryId');
  });

  it('accepts an optional relatedSystemId when present and numeric', () => {
    const result = validateCreateTicketRequest({ ...validBody, relatedSystemId: 3 });
    expect(result.ok).toBe(true);
  });

  it('rejects a non-numeric relatedSystemId', () => {
    const result = validateCreateTicketRequest({ ...validBody, relatedSystemId: 'not-a-number' });
    expect(result.ok).toBe(false);
  });

  it('rejects an unknown requestedPriority value', () => {
    const result = validateCreateTicketRequest({ ...validBody, requestedPriority: 'SUPER_URGENT' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.map((e) => e.field)).toContain('requestedPriority');
  });
});
