import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { useSession } from '@/auth/session';
import { fixtures } from '@/test/fixtures';
import { mockApi, renderWithProviders } from '@/test/utils';

import RegisterScreen from './RegisterScreen';

beforeEach(() => useSession.setState({ status: 'signedOut', token: null }));

test('registers with the device timezone, currency and locale', async () => {
  const calls = mockApi({ 'POST /auth/register': { status: 201, body: { token: 'tok', user: fixtures.user() } } });
  await renderWithProviders(<RegisterScreen />);

  await fireEvent.changeText(screen.getByLabelText('Name'), 'Ana');
  await fireEvent.changeText(screen.getByLabelText('Email'), 'ana@example.com');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'secret123');
  await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));

  await waitFor(() => expect(useSession.getState().status).toBe('signedIn'));
  expect(calls[0].body).toMatchObject({
    name: 'Ana',
    email: 'ana@example.com',
    password: 'secret123',
    timezone: 'Europe/Berlin',
    currency: 'USD',
    locale: 'en',
  });
});

test('shows a taken email under the email field', async () => {
  mockApi({ 'POST /auth/register': { status: 422, body: { message: 'The email has already been taken.', errors: { email: ['The email has already been taken.'] } } } });
  await renderWithProviders(<RegisterScreen />);

  await fireEvent.changeText(screen.getByLabelText('Name'), 'Ana');
  await fireEvent.changeText(screen.getByLabelText('Email'), 'ana@example.com');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'secret123');
  await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));

  expect(await screen.findByText('The email has already been taken.')).toBeTruthy();
});

test('requires 8+ character passwords', async () => {
  mockApi({});
  await renderWithProviders(<RegisterScreen />);

  await fireEvent.changeText(screen.getByLabelText('Name'), 'Ana');
  await fireEvent.changeText(screen.getByLabelText('Email'), 'ana@example.com');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'short');
  await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));

  expect(await screen.findByText('Use at least 8 characters.')).toBeTruthy();
});

test('goes to the first subscription after registering', async () => {
  mockApi({ 'POST /auth/register': { status: 201, body: { token: 'tok', user: fixtures.user() } } });
  await renderWithProviders(<RegisterScreen />);

  await fireEvent.changeText(screen.getByLabelText('Name'), 'Ana');
  await fireEvent.changeText(screen.getByLabelText('Email'), 'ana@example.com');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'secret123');
  await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/subscriptions/new'));
});

test('toggles password visibility', async () => {
  await renderWithProviders(<RegisterScreen />);
  expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);

  await fireEvent.press(screen.getByRole('button', { name: 'Show password' }));
  expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(false);

  await fireEvent.press(screen.getByRole('button', { name: 'Hide password' }));
  expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
});

test('shows the totals currency and timezone and lets the user change the currency', async () => {
  await renderWithProviders(<RegisterScreen />);
  expect(screen.getByText('USD · Europe/Berlin')).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Change' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'EUR' }));

  expect(await screen.findByText('EUR · Europe/Berlin')).toBeTruthy();
});
