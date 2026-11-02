import * as SecureStore from 'expo-secure-store';

import { api } from '@/api/client';
import { queryClient } from '@/api/queryClient';
import { prefs } from '@/lib/prefs';
import { waitFor } from '@testing-library/react-native';

import { useSession } from './session';

beforeEach(async () => {
  await SecureStore.deleteItemAsync('subs.token');
  useSession.setState({ status: 'loading', token: null });
});

test('hydrate signs in with a stored token and out without one', async () => {
  await useSession.getState().hydrate();
  expect(useSession.getState().status).toBe('signedOut');

  await SecureStore.setItemAsync('subs.token', 'stored');
  await useSession.getState().hydrate();
  expect(useSession.getState()).toMatchObject({ status: 'signedIn', token: 'stored' });
});

test('signIn stores the token; signOut wipes token, cache and prefs', async () => {
  await useSession.getState().signIn('fresh');
  expect(await SecureStore.getItemAsync('subs.token')).toBe('fresh');

  queryClient.setQueryData(['me'], { id: 1 });
  await prefs.set('push.asked', '1');
  await useSession.getState().signOut();

  expect(useSession.getState()).toMatchObject({ status: 'signedOut', token: null });
  expect(await SecureStore.getItemAsync('subs.token')).toBeNull();
  expect(queryClient.getQueryData(['me'])).toBeUndefined();
  expect(await prefs.get('push.asked')).toBeNull();
});

test('an API 401 signs the session out', async () => {
  await useSession.getState().signIn('revoked');
  global.fetch = jest.fn(async () => ({ ok: false, status: 401, statusText: 'x', json: async () => ({ message: 'Unauthenticated.' }) }) as Response);

  await api('/me').catch(() => undefined);

  await waitFor(() => expect(useSession.getState().status).toBe('signedOut'));
});
