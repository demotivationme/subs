import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { fixtures } from '@/test/fixtures';
import { mockApi, renderWithProviders } from '@/test/utils';

import { SubscriptionReminders } from './SubscriptionReminders';

const subscription = fixtures.subscription();

test('customizing starts from the defaults and saves the subscription’s own rules', async () => {
  const calls = mockApi({
    'GET /subscriptions/5/reminders': { body: { data: [], meta: { uses_defaults: true } } },
    'GET /reminder-defaults': { body: { data: [fixtures.rule()] } },
    'PUT /subscriptions/5/reminders': { body: { data: [fixtures.rule({ days_before: 3 })], meta: { uses_defaults: false } } },
  });
  await renderWithProviders(<SubscriptionReminders subscription={subscription} />);

  await fireEvent.press(await screen.findByRole('button', { name: 'Customize' }));
  await fireEvent.press(screen.getByRole('radio', { name: '3 days' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ rules: [{ days_before: 3, time_of_day: '09:00', channels: ['push', 'in_app'] }] }));
  expect(await screen.findByText('3 days before at 09:00 · Push, In-app')).toBeTruthy();
});

test('reverting to defaults sends an empty list', async () => {
  const calls = mockApi({
    'GET /subscriptions/5/reminders': { body: { data: [fixtures.rule({ days_before: 0 })], meta: { uses_defaults: false } } },
    'GET /reminder-defaults': { body: { data: [fixtures.rule()] } },
    'PUT /subscriptions/5/reminders': { body: { data: [], meta: { uses_defaults: true } } },
  });
  await renderWithProviders(<SubscriptionReminders subscription={subscription} />);

  expect(await screen.findByText('On the payment day at 09:00 · Push, In-app')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Use default reminders' }));

  await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ rules: [] }));
  expect(await screen.findByText('Using your default reminders.')).toBeTruthy();
});

test('blocks invalid rules before saving', async () => {
  const calls = mockApi({
    'GET /subscriptions/5/reminders': { body: { data: [], meta: { uses_defaults: true } } },
    'GET /reminder-defaults': { body: { data: [fixtures.rule()] } },
  });
  await renderWithProviders(<SubscriptionReminders subscription={subscription} />);

  await fireEvent.press(await screen.findByRole('button', { name: 'Customize' }));
  await fireEvent.press(screen.getByRole('button', { name: 'At' }));
  await fireEvent.changeText(screen.getByLabelText('Time (HH:MM)'), '9');
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

  expect(await screen.findByText('Use the format HH:MM, like 09:00.')).toBeTruthy();
  expect(calls.some((c) => c.method === 'PUT')).toBe(false);
});

test('shows nothing but the switch when reminders are off', async () => {
  mockApi({
    'GET /subscriptions/5/reminders': { body: { data: [], meta: { uses_defaults: true } } },
    'GET /reminder-defaults': { body: { data: [fixtures.rule()] } },
  });
  await renderWithProviders(<SubscriptionReminders subscription={fixtures.subscription({ reminders_enabled: false })} />);

  expect(screen.getByRole('switch', { name: 'Remind me' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Customize' })).toBeNull();
});
