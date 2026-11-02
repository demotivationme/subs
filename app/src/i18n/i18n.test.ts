import { deviceLocale, supportedLocale } from '.';

test('maps language tags to a supported locale', () => {
  expect(supportedLocale('en-GB')).toBe('en');
  expect(supportedLocale('xx-YY')).toBe('en');
  expect(supportedLocale(null)).toBe('en');
  expect(deviceLocale()).toBe('en');
});
