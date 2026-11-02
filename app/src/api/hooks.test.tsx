import { act, waitFor } from '@testing-library/react-native';

import { fixtures } from '@/test/fixtures';
import { createTestQueryClient, mockApi, renderHookWithProviders } from '@/test/utils';

import { NetworkError } from './errors';
import { keys } from './keys';
import { useMarkRead, useInbox } from './notifications';
import { useSubscriptionRules } from './reminders';
import { useCreateSubscription, useSubscriptions } from './subscriptions';

test('useSubscriptions sends the filter as query parameters and unwraps data', async () => {
  const calls = mockApi({ 'GET /subscriptions': { body: { data: [fixtures.subscription()] } } });

  const { result } = await renderHookWithProviders(() => useSubscriptions({ sort: 'price', status: 'paused' }));

  await waitFor(() => expect(result.current.data).toHaveLength(1));
  expect(calls[0].path).toBe('/subscriptions?sort=price&status=paused');
});

test('creating a subscription invalidates lists and the dashboard', async () => {
  mockApi({ 'POST /subscriptions': { status: 201, body: { data: fixtures.subscription() } } });
  const client = createTestQueryClient();
  const spy = jest.spyOn(client, 'invalidateQueries');

  const { result } = await renderHookWithProviders(() => useCreateSubscription(), client);
  await act(() => result.current.mutateAsync({
    service_name: 'Netflix', amount: 1299, currency: 'EUR', period: 'month', interval_count: 1, first_payment_date: '2026-01-15', notes: null,
  }));

  expect(spy).toHaveBeenCalledWith({ queryKey: keys.subscriptionsAll });
  expect(spy).toHaveBeenCalledWith({ queryKey: keys.dashboard });
});

test('offline, a mutation fails at once with NetworkError instead of pausing', async () => {
  global.fetch = jest.fn(async () => {
    throw new TypeError('Network request failed');
  });

  const { result } = await renderHookWithProviders(() => useCreateSubscription());
  const error = await act(() => result.current.mutateAsync({
    service_name: 'X', amount: 1, currency: 'EUR', period: 'month', interval_count: 1, first_payment_date: '2026-01-01', notes: null,
  }).catch((e) => e));

  expect(error).toBeInstanceOf(NetworkError);
  await waitFor(() => expect(result.current.isError).toBe(true));
});

test('a failed refetch keeps showing cached data', async () => {
  const client = createTestQueryClient();
  client.setQueryData(keys.subscriptions({}), [fixtures.subscription()]);
  global.fetch = jest.fn(async () => {
    throw new TypeError('Network request failed');
  });

  const { result } = await renderHookWithProviders(() => useSubscriptions({}), client);

  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.data).toHaveLength(1);
});

test('useSubscriptionRules exposes uses_defaults', async () => {
  mockApi({ 'GET /subscriptions/5/reminders': { body: { data: [], meta: { uses_defaults: true } } } });

  const { result } = await renderHookWithProviders(() => useSubscriptionRules(5));

  await waitFor(() => expect(result.current.data).toEqual({ rules: [], usesDefaults: true }));
});

test('useInbox pages through results', async () => {
  mockApi({
    'GET /notifications?page=1': { body: { data: [fixtures.notification()], meta: { current_page: 1, last_page: 2, total: 2 } } },
    'GET /notifications?page=2': { body: { data: [fixtures.notification({ id: 'second' })], meta: { current_page: 2, last_page: 2, total: 2 } } },
  });

  const { result } = await renderHookWithProviders(() => useInbox());
  await waitFor(() => expect(result.current.hasNextPage).toBe(true));
  await act(() => result.current.fetchNextPage());

  await waitFor(() => expect(result.current.data?.pages.flatMap((p) => p.data).map((n) => n.id)).toEqual([fixtures.notification().id, 'second']));
  expect(result.current.hasNextPage).toBe(false);
});

test('marking a notification read invalidates the inbox and the unread count', async () => {
  mockApi({ 'POST /notifications/abc/read': { status: 204 } });
  const client = createTestQueryClient();
  const spy = jest.spyOn(client, 'invalidateQueries');

  const { result } = await renderHookWithProviders(() => useMarkRead(), client);
  await act(() => result.current.mutateAsync('abc'));
  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(spy).toHaveBeenCalledWith({ queryKey: keys.notifications });
});
