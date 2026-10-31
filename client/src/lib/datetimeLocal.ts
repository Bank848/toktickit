// `<input type="datetime-local">` always reads/writes local wall-clock time with no timezone
// designator. `toDatetimeLocalValue` converts a UTC ISO timestamp into that local-clock string
// for display; `fromDatetimeLocalValue` converts back to a UTC ISO string (with `Z`) for the API.
// Do not replace either with a bare `.toISOString().slice(0,16)` / `new Date(x).toISOString()`
// pair without the offset shift below: that brings back the display/round-trip timezone bug this
// module exists to fix.
export function toDatetimeLocalValue(isoUtc: string): string {
  const utc = new Date(isoUtc);
  const localOffsetMs = utc.getTimezoneOffset() * 60000;
  const shifted = new Date(utc.getTime() - localOffsetMs);
  return shifted.toISOString().slice(0, 16);
}

export function fromDatetimeLocalValue(local: string): string {
  // A date-time string with no timezone designator is parsed as local time by the Date
  // constructor per the ECMAScript spec, so this direction needs no manual offset math.
  const parsed = new Date(local);
  if (Number.isNaN(parsed.getTime())) throw new RangeError('Invalid date/time');
  return parsed.toISOString();
}
