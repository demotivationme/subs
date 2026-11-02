import type { Channel, ReminderRule, ReminderRuleInput } from '@/api/types';
import { addDays } from '@/lib/dates';

export const CHANNELS = ['push', 'in_app', 'email'] as const satisfies readonly Channel[];
export const MAX_RULES = 5;

export type RuleErrors = { daysBefore?: string; timeOfDay?: string; channels?: string };

/** Mirrors the API's rules (0–60 days, HH:MM, ≥1 channel, one rule per lead time); messages are i18n keys. */
export function validateRules(rules: ReminderRuleInput[]): RuleErrors[] {
  return rules.map((rule) => {
    const errors: RuleErrors = {};
    if (!Number.isInteger(rule.days_before) || rule.days_before < 0 || rule.days_before > 60) {
      errors.daysBefore = 'validation.daysBefore';
    } else if (rules.filter((other) => other.days_before === rule.days_before).length > 1) {
      errors.daysBefore = 'validation.duplicateDays';
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(rule.time_of_day)) errors.timeOfDay = 'validation.time';
    if (rule.channels.length === 0) errors.channels = 'validation.channels';
    return errors;
  });
}

export function hasRuleErrors(errors: RuleErrors[]): boolean {
  return errors.some((e) => Object.keys(e).length > 0);
}

export function defaultRule(existing: ReminderRuleInput[]): ReminderRuleInput {
  const used = new Set(existing.map((r) => r.days_before));
  const days = [1, 3, 7, 0, 14, 30].find((d) => !used.has(d)) ?? 2;
  return { days_before: days, time_of_day: '09:00', channels: ['push', 'in_app'] };
}

export function toRuleInputs(rules: ReminderRule[]): ReminderRuleInput[] {
  return rules.map(({ days_before, time_of_day, channels }) => ({ days_before, time_of_day, channels }));
}

/** The soonest reminder that is still ahead, as { date, time }; null when none is (e.g. a past payment date). */
export function firstReminder(paymentDate: string, rules: ReminderRuleInput[], today: string): { date: string; time: string } | null {
  const upcoming = rules
    .filter((rule) => Number.isInteger(rule.days_before) && /^\d{2}:\d{2}$/.test(rule.time_of_day))
    .map((rule) => ({ date: addDays(paymentDate, -rule.days_before), time: rule.time_of_day }))
    .filter((reminder) => reminder.date >= today)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  return upcoming[0] ?? null;
}
