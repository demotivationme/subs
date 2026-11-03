import { z } from 'zod';

import type { SubscriptionPayload } from '@/api/subscriptions';
import type { Subscription } from '@/api/types';
import { ApiError } from '@/api/errors';
import { isValidIsoDate } from '@/lib/dates';
import { minorToInput, parseMoney } from '@/lib/money';

const MAX_AMOUNT = 100_000_000;

/** Form state keeps what people type (strings); toPayload converts to the API's types. */
export const subscriptionFormSchema = z
  .object({
    serviceId: z.number().int().nullable(),
    serviceName: z.string().max(100),
    categoryId: z.number().int().nullable(),
    amount: z.string(),
    currency: z.string().regex(/^[A-Z]{3}$/, 'validation.currency'),
    period: z.enum(['week', 'month', 'year']),
    intervalCount: z.string(),
    firstPaymentDate: z.string().refine(isValidIsoDate, 'validation.date'),
    notes: z.string().max(1000),
  })
  .superRefine((v, ctx) => {
    if (v.serviceId === null && v.serviceName.trim() === '') {
      ctx.addIssue({ code: 'custom', path: ['serviceName'], message: 'validation.serviceRequired' });
    }
    const minor = parseMoney(v.amount, v.currency);
    if (minor === null) {
      ctx.addIssue({ code: 'custom', path: ['amount'], message: 'validation.amount' });
    } else if (minor > MAX_AMOUNT) {
      ctx.addIssue({ code: 'custom', path: ['amount'], message: 'validation.amountTooLarge' });
    }
    const interval = Number(v.intervalCount);
    if (!/^\d+$/.test(v.intervalCount) || interval < 1 || interval > 365) {
      ctx.addIssue({ code: 'custom', path: ['intervalCount'], message: 'validation.interval' });
    }
  });

export type SubscriptionFormValues = z.infer<typeof subscriptionFormSchema>;

export function defaultFormValues(currency: string, today: string): SubscriptionFormValues {
  return {
    serviceId: null,
    serviceName: '',
    categoryId: null,
    amount: '',
    currency,
    period: 'month',
    intervalCount: '1',
    firstPaymentDate: today,
    notes: '',
  };
}

export function toFormValues(s: Subscription): SubscriptionFormValues {
  return {
    serviceId: s.service.id,
    serviceName: s.service.name,
    categoryId: s.category.id,
    amount: minorToInput(s.amount, s.currency),
    currency: s.currency,
    period: s.period,
    intervalCount: String(s.interval_count),
    // The edit form shows (and previews reminders from) the next payment; the anchor is sent only if changed.
    firstPaymentDate: s.next_payment_date,
    notes: s.notes ?? '',
  };
}

/** Call only with values that passed subscriptionFormSchema. */
export function toPayload(v: SubscriptionFormValues): SubscriptionPayload {
  const notes = v.notes.trim();
  return {
    ...(v.serviceId !== null ? { service_id: v.serviceId } : { service_name: v.serviceName.trim() }),
    ...(v.categoryId !== null ? { category_id: v.categoryId } : {}),
    amount: parseMoney(v.amount, v.currency) as number,
    currency: v.currency,
    period: v.period,
    interval_count: Number(v.intervalCount),
    first_payment_date: v.firstPaymentDate,
    notes: notes === '' ? null : notes,
  };
}

/** API field names in a 422 mapped onto the form's fields. */
export const SERVER_FIELDS: Record<string, keyof SubscriptionFormValues> = {
  service_id: 'serviceName',
  service_name: 'serviceName',
  category_id: 'categoryId',
  amount: 'amount',
  currency: 'currency',
  period: 'period',
  interval_count: 'intervalCount',
  first_payment_date: 'firstPaymentDate',
  notes: 'notes',
};

export type FieldErrors = Partial<Record<keyof SubscriptionFormValues, string>>;

/** The 422's field messages by form field, or null when the error is not a mappable validation error. */
export function serverFieldErrors(error: unknown): FieldErrors | null {
  if (!(error instanceof ApiError) || error.status !== 422) return null;
  const result: FieldErrors = {};
  for (const [key, messages] of Object.entries(error.errors)) {
    const field = SERVER_FIELDS[key];
    if (field && messages[0]) result[field] = messages[0];
  }
  return Object.keys(result).length > 0 ? result : null;
}

/** Client validation as { field: i18n key }, empty when the values are valid. */
export function validateForm(values: SubscriptionFormValues): FieldErrors {
  const result = subscriptionFormSchema.safeParse(values);
  if (result.success) return {};
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof SubscriptionFormValues;
    errors[field] ??= issue.message;
  }
  return errors;
}
