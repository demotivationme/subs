import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { keys } from '@/api/keys';
import { fixtures } from '@/test/fixtures';
import { createTestQueryClient, mockApi, renderWithProviders, type MockRoute } from '@/test/utils';

import SubscriptionDetailScreen from './SubscriptionDetailScreen';

function setup(extra: Record<string, MockRoute> = {}) {
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: '5' });
  const calls = mockApi({
    'GET /subscriptions/5': { body: { data: fixtures.subscription({ notes: 'Family plan' }) } },
    'GET /categories': { body: { data: [fixtures.category()] } },
    'GET /subscriptions/5/reminders': { body: { data: [], meta: { uses_defaults: true } } },
    'GET /reminder-defaults': { body: { data: [fixtures.rule()] } },
    ...extra,
  });
  const client = createTestQueryClient();
  client.setQueryData(keys.me, fixtures.user());
  return { calls, client };
}

const patch = (calls: { method: string; body: unknown }[]) => calls.find((c) => c.method === 'PATCH')?.body;

test('shows the subscription', async () => {
  const { client } = setup();
  await renderWithProviders(<SubscriptionDetailScreen />, client);

  expect(await screen.findByText('Netflix')).toBeTruthy();
  expect(screen.getByText('Video Streaming · Active')).toBeTruthy();
  expect(screen.getByText('€12.99')).toBeTruthy();
  expect(screen.getByText('monthly')).toBeTruthy();
  expect(screen.getByText('€155.88 per year')).toBeTruthy();
  expect(screen.getByText('Nov 15, 2026')).toBeTruthy();
  expect(screen.getByText('Jan 15, 2026')).toBeTruthy();
  expect(screen.getByText('Family plan')).toBeTruthy();
  expect(screen.queryByText(/in your currency/)).toBeNull();
  expect(await screen.findByText('Using your default reminders.')).toBeTruthy();
});

test('the Remind me switch PATCHes the flag', async () => {
  const { calls, client } = setup({ 'PATCH /subscriptions/5': { body: { data: fixtures.subscription({ reminders_enabled: false }) } } });
  await renderWithProviders(<SubscriptionDetailScreen />, client);

  await fireEvent(await screen.findByRole('switch', { name: 'Remind me' }), 'valueChange', false);

  await waitFor(() => expect(patch(calls)).toEqual({ reminders_enabled: false }));
  await waitFor(() => expect(screen.queryByText('Using your default reminders.')).toBeNull());
});

test('pauses an active subscription', async () => {
  const { calls, client } = setup({ 'PATCH /subscriptions/5': { body: { data: fixtures.subscription({ status: 'paused' }) } } });
  await renderWithProviders(<SubscriptionDetailScreen />, client);

  await fireEvent.press(await screen.findByRole('button', { name: 'Pause' }));

  await waitFor(() => expect(patch(calls)).toEqual({ status: 'paused' }));
  expect(await screen.findByRole('button', { name: 'Resume' })).toBeTruthy();
});

test('marks a subscription as cancelled', async () => {
  const { calls, client } = setup({ 'PATCH /subscriptions/5': { body: { data: fixtures.subscription({ status: 'cancelled' }) } } });
  await renderWithProviders(<SubscriptionDetailScreen />, client);

  await fireEvent.press(await screen.findByRole('button', { name: 'Mark as cancelled' }));

  await waitFor(() => expect(patch(calls)).toEqual({ status: 'cancelled' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Mark as cancelled' })).toBeNull());
});

test('deleting needs a second tap', async () => {
  const { calls, client } = setup({ 'DELETE /subscriptions/5': { status: 204 } });
  await renderWithProviders(<SubscriptionDetailScreen />, client);

  await fireEvent.press(await screen.findByRole('button', { name: 'Delete subscription' }));
  expect(calls.some((c) => c.method === 'DELETE')).toBe(false);

  await fireEvent.press(screen.getByRole('button', { name: 'Tap again to delete' }));
  await waitFor(() => expect(router.back).toHaveBeenCalled());
  expect(calls.some((c) => c.method === 'DELETE' && c.path === '/subscriptions/5')).toBe(true);
});

test('edits through the add flow’s price and reminder steps', async () => {
  const { calls, client } = setup({ 'PATCH /subscriptions/5': { body: { data: fixtures.subscription({ amount: 1599 }) } } });
  await renderWithProviders(<SubscriptionDetailScreen />, client);

  await fireEvent.press(await screen.findByRole('button', { name: 'Edit' }));
  const amount = await screen.findByLabelText('Amount');
  expect(amount.props.value).toBe('12.99');
  await fireEvent.changeText(amount, '15.99');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Save' }));

  await waitFor(() => expect(patch(calls)).toMatchObject({ service_id: 3, category_id: 2, amount: 1599, reminders_enabled: true }));
  expect(calls.some((c) => c.method === 'PUT')).toBe(false);
  expect(await screen.findByText('€15.99')).toBeTruthy();
});

test('blocks an invalid amount in edit mode', async () => {
  const { calls, client } = setup();
  await renderWithProviders(<SubscriptionDetailScreen />, client);

  await fireEvent.press(await screen.findByRole('button', { name: 'Edit' }));
  await fireEvent.changeText(await screen.findByLabelText('Amount'), 'abc');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

  expect(await screen.findByText('Enter a valid amount, like 12.99.')).toBeTruthy();
  expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
});

test('shows the monthly amount in your currency when it adds information', async () => {
  const { client } = setup({
    'GET /subscriptions/5': { body: { data: fixtures.subscription({ currency: 'USD', amount: 1000, monthly_equivalent: 920 }) } },
  });
  await renderWithProviders(<SubscriptionDetailScreen />, client);

  expect(await screen.findByText('€9.20 per month in your currency')).toBeTruthy();
});

test('explains a subscription that no longer exists', async () => {
  const { client } = setup({ 'GET /subscriptions/5': { status: 404, body: { message: 'No query results for model.' } } });
  await renderWithProviders(<SubscriptionDetailScreen />, client);

  expect(await screen.findByText("This subscription doesn't exist anymore.")).toBeTruthy();
});
