import {
  addDays,
  dateTile,
  daysBetween,
  formatDate,
  isoToLocalDate,
  isValidIsoDate,
  localDateToIso,
  localDateToTime,
  timeToLocalDate,
  todayIso,
} from './dates';

test('reminder times round-trip through the local Date a picker uses', () => {
  const date = timeToLocalDate('07:45');
  expect([date.getHours(), date.getMinutes()]).toEqual([7, 45]);
  expect(localDateToTime(date)).toBe('07:45');
  expect(localDateToTime(new Date(2026, 5, 1, 23, 0))).toBe('23:00');
});

test('billing dates round-trip through the local Date a picker uses', () => {
  const date = isoToLocalDate('2026-03-29');
  expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2026, 2, 29, 0]);
  expect(localDateToIso(date)).toBe('2026-03-29');
  expect(localDateToIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
});

afterEach(() => jest.useRealTimers());

test('formats a billing date without timezone drift', () => {
  expect(formatDate('2026-11-02', 'en')).toBe('Nov 2, 2026');
});

test('today follows the given timezone', () => {
  jest.useFakeTimers({ now: new Date('2026-11-01T23:30:00Z') });
  expect(todayIso('Europe/Berlin')).toBe('2026-11-02');
  expect(todayIso('America/New_York')).toBe('2026-11-01');
});

test('today works without DateTimeFormat#formatToParts (Hermes)', () => {
  jest.useFakeTimers({ now: new Date('2026-11-01T23:30:00Z') });
  const proto = Intl.DateTimeFormat.prototype as Partial<Intl.DateTimeFormat>;
  const original = proto.formatToParts;
  delete proto.formatToParts;
  try {
    expect(todayIso('Europe/Berlin')).toBe('2026-11-02');
    expect(todayIso('America/New_York')).toBe('2026-11-01');
  } finally {
    proto.formatToParts = original;
  }
});

test.each([
  ['2026-02-28', true],
  ['2028-02-29', true],
  ['2026-02-29', false],
  ['2026-13-01', false],
  ['2026-1-01', false],
  ['01.02.2026', false],
])('isValidIsoDate(%p) is %p', (value, expected) => {
  expect(isValidIsoDate(value)).toBe(expected);
});

describe('daysBetween and dateTile', () => {

  test('counts calendar days between two billing dates', () => {
    expect(daysBetween('2026-11-02', '2026-11-02')).toBe(0);
    expect(daysBetween('2026-11-02', '2026-11-15')).toBe(13);
    expect(daysBetween('2026-12-30', '2027-01-02')).toBe(3);
    expect(daysBetween('2026-11-02', '2026-11-01')).toBe(-1);
  });

  test('splits a date into an uppercase month and a day number', () => {
    expect(dateTile('2026-11-05', 'en')).toEqual({ month: 'NOV', day: '5' });
  });
});

test('addDays moves a billing date without a timezone shift', () => {
  expect(addDays('2026-11-02', 1)).toBe('2026-11-03');
  expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
});
