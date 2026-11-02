import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { keys } from '@/api/keys';
import { useSession } from '@/auth/session';
import { disablePush, enablePush } from '@/push';
import { fixtures } from '@/test/fixtures';
import { createTestQueryClient, mockApi, renderWithProviders, type MockRoute } from '@/test/utils';

import SettingsScreen from './SettingsScreen';

jest.mock('@/push', () => ({
  enablePush: jest.fn(async () => 'enabled'),
  disablePush: jest.fn(async () => undefined),
  isPushEnabled: jest.fn(async () => false),
  isPushSupported: jest.fn(() => true),
}));

function setup(extra: Record<string, MockRoute> = {}, user = fixtures.user({ timezone: 'America/New_York' })) {
  const calls = mockApi({
    'GET /me': { body: { data: user } },
    'GET /reminder-defaults': { body: { data: [fixtures.rule()] } },
    'PATCH /me': ({ body }) => ({ body: { data: { ...user, ...(body as object) } } }),
    ...extra,
  });
  const client = createTestQueryClient();
  client.setQueryData(keys.me, user);
  useSession.setState({ status: 'signedIn', token: 'tok' });
  return { calls, client };
}

const patched = (calls: { method: string; body: unknown }[], field: string, value: string) =>
  calls.some((c) => c.method === 'PATCH' && (c.body as Record<string, string>)[field] === value);

test('shows the profile values on their rows', async () => {
  const { client } = setup();
  await renderWithProviders(<SettingsScreen />, client);

  expect(await screen.findByText('America/New_York')).toBeTruthy();
  expect(screen.getByText('English')).toBeTruthy();
  expect(await screen.findByText('1 day before at 09:00 · Push, In-app')).toBeTruthy();
});

test('updates the name through its modal', async () => {
  const { calls, client } = setup();
  await renderWithProviders(<SettingsScreen />, client);

  await fireEvent.press(await screen.findByRole('button', { name: 'Name' }));
  await fireEvent.changeText(screen.getByDisplayValue(fixtures.user().name), 'Ana María');
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

  await waitFor(() => expect(patched(calls, 'name', 'Ana María')).toBe(true));
});

test('updates the currency and the timezone', async () => {
  const { calls, client } = setup();
  await renderWithProviders(<SettingsScreen />, client);

  await fireEvent.press(await screen.findByRole('button', { name: 'Main currency' }));
  await fireEvent.changeText(screen.getByLabelText('Search'), 'USD');
  await fireEvent.press(screen.getByRole('button', { name: 'USD' }));
  await waitFor(() => expect(patched(calls, 'currency', 'USD')).toBe(true));

  await fireEvent.press(screen.getByRole('button', { name: 'Timezone' }));
  await fireEvent.press(screen.getByRole('button', { name: "Use this device's timezone (Europe/Berlin)" }));
  await waitFor(() => expect(patched(calls, 'timezone', 'Europe/Berlin')).toBe(true));
});

test('opens the default reminders screen', async () => {
  const { client } = setup();
  await renderWithProviders(<SettingsScreen />, client);

  await fireEvent.press(await screen.findByRole('button', { name: 'Default reminders' }));
  expect(router.push).toHaveBeenCalledWith('/settings/reminders');
});

test('the push switch enables and disables push, and explains a denial', async () => {
  const { client } = setup();
  await renderWithProviders(<SettingsScreen />, client);
  const toggle = await screen.findByLabelText('Push notifications on this device');

  await fireEvent(toggle, 'valueChange', true);
  expect(enablePush).toHaveBeenCalled();

  await fireEvent(toggle, 'valueChange', false);
  expect(disablePush).toHaveBeenCalled();

  jest.mocked(enablePush).mockResolvedValueOnce('denied');
  await fireEvent(toggle, 'valueChange', true);
  expect(await screen.findByText('Notifications are blocked. Allow them in your system settings.')).toBeTruthy();
});

test('shows a Verified pill for a verified email', async () => {
  const { client } = setup({}, fixtures.user({ email_verified: true }));
  await renderWithProviders(<SettingsScreen />, client);
  expect(await screen.findByText('Verified')).toBeTruthy();
  expect(screen.queryByText('Verify your email to receive email reminders.')).toBeNull();
});

test('shows the verify banner for an unverified email', async () => {
  const { client } = setup({}, fixtures.user({ email_verified: false }));
  await renderWithProviders(<SettingsScreen />, client);
  expect(await screen.findByText('Verify your email to receive email reminders.')).toBeTruthy();
  expect(screen.queryByText('Verified')).toBeNull();
});

test('logs out after forgetting this device', async () => {
  const { calls, client } = setup({ 'POST /auth/logout': { status: 204 } });
  await renderWithProviders(<SettingsScreen />, client);

  await fireEvent.press(await screen.findByRole('button', { name: 'Log out' }));

  await waitFor(() => expect(useSession.getState().status).toBe('signedOut'));
  expect(disablePush).toHaveBeenCalled();
  expect(calls.some((c) => c.path === '/auth/logout')).toBe(true);
});

test('deleting the account needs the password', async () => {
  const { client } = setup({ 'DELETE /me': { status: 422, body: { message: 'The password is incorrect.', errors: { password: ['The password is incorrect.'] } } } });
  await renderWithProviders(<SettingsScreen />, client);

  await fireEvent.changeText(await screen.findByLabelText('Confirm with your password'), 'wrong');
  await fireEvent.press(screen.getByRole('button', { name: 'Delete my account' }));

  expect(await screen.findByText('The password is incorrect.')).toBeTruthy();
  expect(useSession.getState().status).toBe('signedIn');
});

test('opens category management', async () => {
  const { client } = setup();
  await renderWithProviders(<SettingsScreen />, client);

  await fireEvent.press(await screen.findByRole('link', { name: 'Manage categories' }));
  expect(router.push).toHaveBeenCalledWith('/categories');
});
