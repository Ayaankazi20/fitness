import { badRequest } from './errors.js';

/** tz = minutes behind UTC, same sign as JS Date.getTimezoneOffset() (IST = -330). */
export function dayRangeUtc(dateStr: string, tzOffsetMin = 0): { start: Date; end: Date } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) throw badRequest('INVALID_DATE', 'Date must be YYYY-MM-DD');
  const start = new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!) + tzOffsetMin * 60000);
  return { start, end: new Date(start.getTime() + 86400000) };
}
export function localDateString(d: Date, tzOffsetMin = 0): string {
  return new Date(d.getTime() - tzOffsetMin * 60000).toISOString().slice(0, 10);
}
export function todayString(tzOffsetMin = 0): string { return localDateString(new Date(), tzOffsetMin); }
export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
