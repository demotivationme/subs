import { defaultRule, firstReminder, hasRuleErrors, validateRules } from './rules';

test('accepts valid rules', () => {
  const errors = validateRules([
    { days_before: 0, time_of_day: '23:59', channels: ['email'] },
    { days_before: 7, time_of_day: '09:00', channels: ['push', 'in_app'] },
  ]);
  expect(hasRuleErrors(errors)).toBe(false);
});

test('flags bad days, times, empty channels and duplicate days', () => {
  expect(
    validateRules([
      { days_before: 61, time_of_day: '9:00', channels: [] },
      { days_before: 1, time_of_day: '24:00', channels: ['push'] },
      { days_before: 1, time_of_day: '09:00', channels: ['push'] },
      { days_before: Number.NaN, time_of_day: '09:00', channels: ['push'] },
    ]),
  ).toEqual([
    { daysBefore: 'validation.daysBefore', timeOfDay: 'validation.time', channels: 'validation.channels' },
    { daysBefore: 'validation.duplicateDays', timeOfDay: 'validation.time' },
    { daysBefore: 'validation.duplicateDays' },
    { daysBefore: 'validation.daysBefore' },
  ]);
});

test('a new rule picks an unused lead time', () => {
  expect(defaultRule([]).days_before).toBe(1);
  expect(defaultRule([{ days_before: 1, time_of_day: '09:00', channels: ['push'] }]).days_before).toBe(3);
});

test('the first reminder is the soonest one that is still ahead', () => {
  const rules = [
    { days_before: 1, time_of_day: '09:00', channels: ['push' as const] },
    { days_before: 7, time_of_day: '18:00', channels: ['push' as const] },
  ];
  expect(firstReminder('2026-11-11', rules, '2026-11-02')).toEqual({ date: '2026-11-04', time: '18:00' });
  expect(firstReminder('2026-11-05', rules, '2026-11-02')).toEqual({ date: '2026-11-04', time: '09:00' });
  expect(firstReminder('2026-11-02', rules, '2026-11-02')).toBeNull();
  expect(firstReminder('2026-11-11', [], '2026-11-02')).toBeNull();
});
