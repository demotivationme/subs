import i18n from '@/i18n';

import { periodLabel } from './period';

test('labels billing periods with plurals', () => {
  expect(periodLabel(i18n.t, 'month', 1)).toBe('monthly');
  expect(periodLabel(i18n.t, 'month', 3)).toBe('every 3 months');
  expect(periodLabel(i18n.t, 'week', 2)).toBe('every 2 weeks');
  expect(periodLabel(i18n.t, 'year', 1)).toBe('yearly');
});
