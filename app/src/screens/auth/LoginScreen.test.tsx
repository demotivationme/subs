import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { keys } from '@/api/keys';
import { useSession } from '@/auth/session';
import { fixtures } from '@/test/fixtures';
import { mockApi, renderWithProviders } from '@/test/utils';

import LoginScreen from './LoginScreen';

beforeEach(() => useSession.setState({ status: 'signedOut', token: null }));

async function submit(email: string, password: string) {
  await fireEvent.changeText(screen.getByLabelText('Email'), email);
  await fireEvent.changeText(screen.getByLabelText('Password'), password);
  await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
}

test('logs in, stores the token and primes the profile cache', async () => {
  const user = fixtures.user();
  const calls = mockApi({ 'POST /auth/login': { body: { token: 'tok', user } } });
  const { client } = await renderWithProviders(<LoginScreen />);

  await submit('ana@example.com', 'secret123');

  await waitFor(() => expect(useSession.getState()).toMatchObject({ status: 'signedIn', token: 'tok' }));
  expect(calls[0].body).toMatchObject({ email: 'ana@example.com', password: 'secret123' });
  expect(typeof (calls[0].body as { device_name: string }).device_name).toBe('string');
  expect(client.getQueryData(keys.me)).toEqual(user);
});

test('validates before calling the API', async () => {
  const calls = mockApi({});
  await renderWithProviders(<LoginScreen />);

  await submit('not-an-email', '');

  expect(await screen.findByText('Enter a valid email address.')).toBeTruthy();
  expect(screen.getByText('This field is required.')).toBeTruthy();
  expect(calls).toHaveLength(0);
});

test('shows the server message under the email field on 422', async () => {
  mockApi({ 'POST /auth/login': { status: 422, body: { message: 'These credentials do not match our records.', errors: { email: ['These credentials do not match our records.'] } } } });
  await renderWithProviders(<LoginScreen />);

  await submit('ana@example.com', 'wrong-pass');

  expect(await screen.findByText('These credentials do not match our records.')).toBeTruthy();
  expect(useSession.getState().status).toBe('signedOut');
});

test('explains rate limiting', async () => {
  mockApi({ 'POST /auth/login': { status: 429, body: { message: 'Too Many Attempts.' } } });
  await renderWithProviders(<LoginScreen />);

  await submit('ana@example.com', 'secret123');

  expect(await screen.findByText('Too many attempts. Please wait a minute and try again.')).toBeTruthy();
});
