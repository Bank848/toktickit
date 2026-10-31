import { describe, it, expect } from 'vitest';
import { toDatetimeLocalValue, fromDatetimeLocalValue } from '../../src/lib/datetimeLocal';

describe('datetimeLocal', () => {
  it('CMP-10 round-trips a UTC ISO timestamp to the exact same instant, in any runner timezone', () => {
    const original = '2026-09-20T10:00:00.000Z';
    const roundTripped = fromDatetimeLocalValue(toDatetimeLocalValue(original));
    expect(new Date(roundTripped).getTime()).toBe(new Date(original).getTime());
    expect(roundTripped).toBe(original);
  });

  it("CMP-10 the produced value reflects the runner's UTC offset, not the raw UTC clock digits", () => {
    const utcNoon = '2026-09-20T12:00:00.000Z';
    const localValue = toDatetimeLocalValue(utcNoon);
    const runnerOffsetMinutes = new Date(utcNoon).getTimezoneOffset();
    if (runnerOffsetMinutes !== 0) {
      expect(localValue).not.toBe('2026-09-20T12:00');
    }
  });

  it('CMP-10 sends a UTC ISO string ending in Z', () => {
    expect(fromDatetimeLocalValue('2026-09-20T10:00')).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('CMP-10 throws on an empty value instead of returning "Invalid Date"', () => {
    expect(() => fromDatetimeLocalValue('')).toThrow(RangeError);
  });
});
