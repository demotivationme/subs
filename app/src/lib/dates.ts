import { getCalendars } from 'expo-localization';

function parts(isoDate: string): [number, number, number] {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  return [y, m, d];
}

/** A billing date (YYYY-MM-DD), formatted without shifting it through the local timezone. */
export function formatDate(isoDate: string, locale: string): string {
  const [y, m, d] = parts(isoDate);
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** A timestamp (ISO 8601 with offset) in the device's timezone. */
export function formatDateTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

/** Today's date (YYYY-MM-DD) in the given IANA timezone (the device's when omitted). */
export function todayIso(timeZone?: string): string {
  const fields = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date());
  const get = (type: string) => fields.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = parts(value);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function deviceTimeZone(): string {
  return getCalendars()[0]?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
}

/** Whole calendar days from one billing date to another (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = parts(from);
  const [ty, tm, td] = parts(to);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

/** The month abbreviation and day number shown on a date tile. */
export function dateTile(isoDate: string, locale: string): { month: string; day: string } {
  const [y, m, d] = parts(isoDate);
  const date = new Date(Date.UTC(y, m - 1, d));
  return {
    month: new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(date).toUpperCase(),
    day: new Intl.DateTimeFormat(locale, { day: 'numeric', timeZone: 'UTC' }).format(date),
  };
}
