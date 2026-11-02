import { formatDate, isValidIsoDate, todayIso } from './dates';

afterEach(() => jest.useRealTimers());

test('formats a billing date without timezone drift', () => {
  expect(formatDate('2026-11-02', 'en')).toBe('Nov 2, 2026');
});

test('today follows the given timezone', () => {
  jest.useFakeTimers({ now: new Date('2026-11-01T23:30:00Z') });
  expect(todayIso('Europe/Berlin')).toBe('2026-11-02');
  expect(todayIso('America/New_York')).toBe('2026-11-01');
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
