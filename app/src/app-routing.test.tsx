import { act, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import * as SecureStore from 'expo-secure-store';
import { Text } from 'react-native';

import '@/i18n';
import { useSession } from '@/auth/session';
import { prefs } from '@/lib/prefs';

import AuthLayout from './app/(auth)/_layout';
import RootLayout from './app/_layout';
import StartScreen from './screens/auth/StartScreen';

// babel-jest hoists these above the imports.
jest.unmock('expo-router');
// NativeWind's stylesheet is compiled by Metro, not Jest.
jest.mock('./global.css', () => ({}));

const marker = (label: string) => function Marker() { return <Text>{label}</Text>; };

const routes = {
  _layout: RootLayout,
  '(auth)/_layout': AuthLayout,
  '(auth)/start': StartScreen,
  '(auth)/welcome': marker('welcome-marker'),
  '(auth)/login': marker('login-marker'),
  '(app)/_layout': jest.requireActual('expo-router').Slot,
  '(app)/index': marker('app-index-marker'),
  '(app)/subscriptions/[id]': marker('subscription-marker'),
};

async function signedOut(seen: boolean) {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
  if (seen) await prefs.set('onboarding.seen', '1');
  else await prefs.remove('onboarding.seen');
}

beforeEach(() => useSession.setState({ status: 'loading', token: null }));

test('signed out, first run: lands on welcome', async () => {
  await signedOut(false);
  await renderRouter(routes, { initialUrl: '/' });
  expect(await screen.findByText('welcome-marker')).toBeTruthy();
});

test('signed out, onboarding seen: lands on login', async () => {
  await signedOut(true);
  await renderRouter(routes, { initialUrl: '/' });
  expect(await screen.findByText('login-marker')).toBeTruthy();
});

test('signed out deep link does not reach the app screen', async () => {
  await signedOut(true);
  await renderRouter(routes, { initialUrl: '/subscriptions/5' });
  expect(await screen.findByText('login-marker')).toBeTruthy();
  expect(screen.queryByText('subscription-marker')).toBeNull();
});

test('signed in: lands on the app index', async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue('tok');
  await renderRouter(routes, { initialUrl: '/' });
  expect(await screen.findByText('app-index-marker')).toBeTruthy();
});

test('signing out from the app returns to login', async () => {
  await prefs.set('onboarding.seen', '1');
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue('tok');
  await renderRouter(routes, { initialUrl: '/' });
  expect(await screen.findByText('app-index-marker')).toBeTruthy();

  await act(async () => {
    await useSession.getState().signOut();
  });
  expect(await screen.findByText('login-marker')).toBeTruthy();
});
