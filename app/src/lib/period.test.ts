import i18n from '@/i18n';

import { periodLabel, yearlyAmount } from './period';

test('labels billing periods with plurals', () => {
  expect(periodLabel(i18n.t, 'month', 1)).toBe('monthly');
  expect(periodLabel(i18n.t, 'month', 3)).toBe('every 3 months');
  expect(periodLabel(i18n.t, 'week', 2)).toBe('every 2 weeks');
  expect(periodLabel(i18n.t, 'year', 1)).toBe('yearly');
});

test('scales a billing cycle to a year', () => {
  expect(yearlyAmount(1299, 'month', 1)).toBe(15588);
  expect(yearlyAmount(1000, 'month', 3)).toBe(4000);
  expect(yearlyAmount(500, 'week', 2)).toBe(13000);
  expect(yearlyAmount(9999, 'year', 1)).toBe(9999);
});
