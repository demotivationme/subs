import { ApiError } from '@/api/errors';
import { fixtures } from '@/test/fixtures';

import { defaultFormValues, subscriptionFormSchema, toFormValues, toPayload, serverFieldErrors, validateForm, type SubscriptionFormValues } from './schema';

const base: SubscriptionFormValues = { ...defaultFormValues('EUR', '2026-11-02'), serviceId: 3, serviceName: 'Netflix', amount: '12,99' };

function issues(values: SubscriptionFormValues): Record<string, string> {
  const result = subscriptionFormSchema.safeParse(values);
  return result.success ? {} : Object.fromEntries(result.error.issues.map((i) => [i.path.join('.'), i.message]));
}

test('a catalog service becomes service_id with minor-unit amounts', () => {
  expect(issues(base)).toEqual({});
  expect(toPayload(base)).toEqual({
    service_id: 3,
    amount: 1299,
    currency: 'EUR',
    period: 'month',
    interval_count: 1,
    first_payment_date: '2026-11-02',
    notes: null,
  });
});

test('a typed name becomes service_name, and category and notes are sent when set', () => {
  const payload = toPayload({ ...base, serviceId: null, serviceName: '  My Gym ', categoryId: 4, notes: ' family plan ', amount: '1600', currency: 'JPY' });
  expect(payload).toMatchObject({ service_name: 'My Gym', category_id: 4, notes: 'family plan', amount: 1600, currency: 'JPY' });
  expect(payload).not.toHaveProperty('service_id');
});

test.each([
  [{ serviceId: null, serviceName: '' }, 'serviceName', 'validation.serviceRequired'],
  [{ amount: '1.5', currency: 'JPY' }, 'amount', 'validation.amount'],
  [{ amount: '' }, 'amount', 'validation.amount'],
  [{ amount: '1000001' }, 'amount', 'validation.amountTooLarge'],
  [{ intervalCount: '0' }, 'intervalCount', 'validation.interval'],
  [{ intervalCount: '2.5' }, 'intervalCount', 'validation.interval'],
  [{ firstPaymentDate: '2026-02-30' }, 'firstPaymentDate', 'validation.date'],
])('%p is rejected on %s', (patch, path, message) => {
  expect(issues({ ...base, ...patch })[path]).toBe(message);
});

test('toFormValues prefills an edit form that round-trips', () => {
  const values = toFormValues(fixtures.subscription({ amount: 5000, currency: 'KWD', interval_count: 3, notes: 'x' }));
  expect(values).toMatchObject({ serviceId: 3, serviceName: 'Netflix', categoryId: 2, amount: '5.000', intervalCount: '3', notes: 'x' });
  expect(toPayload(values)).toMatchObject({ amount: 5000, interval_count: 3, category_id: 2 });
});

test('server 422s map onto form fields; other errors do not', () => {
  const error = new ApiError(422, 'x', { service_id: ['Pick one.'], first_payment_date: ['Bad date.'], unknown: ['?'] });
  expect(serverFieldErrors(error)).toEqual({ serviceName: 'Pick one.', firstPaymentDate: 'Bad date.' });
  expect(serverFieldErrors(new ApiError(403, 'limit', {}))).toBeNull();
  expect(serverFieldErrors(new ApiError(422, 'x', { unknown: ['?'] }))).toBeNull();
});

test('validateForm returns the first message per field', () => {
  expect(validateForm({ ...base, amount: '', serviceId: null, serviceName: '' })).toEqual({
    serviceName: 'validation.serviceRequired',
    amount: 'validation.amount',
  });
});
