import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';

import { prefs } from '@/lib/prefs';
import { mockApi } from '@/test/utils';

import { disablePush, enablePush, isPushEnabled } from '.';
import { markPushOffered, shouldOfferPush } from './offer';

beforeEach(() => prefs.clear());

test('enabling asks permission and registers the Expo token', async () => {
  const calls = mockApi({ 'POST /devices': { status: 204 } });

  await expect(enablePush()).resolves.toBe('enabled');

  expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
  expect(calls[0]).toMatchObject({ method: 'POST', path: '/devices', body: { token: 'ExponentPushToken[test]', platform: 'ios' } });
  expect(await isPushEnabled()).toBe(true);
});

test('a denied permission is reported, not thrown, and registers nothing', async () => {
  jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValueOnce({ status: 'denied' } as never);
  const calls = mockApi({});

  await expect(enablePush()).resolves.toBe('denied');

  expect(calls).toHaveLength(0);
  expect(await isPushEnabled()).toBe(false);
});

test('without an EAS projectId push is unsupported', async () => {
  const extra = Constants.expoConfig!.extra;
  Constants.expoConfig!.extra = {};
  try {
    await expect(enablePush()).resolves.toBe('unsupported');
  } finally {
    Constants.expoConfig!.extra = extra;
  }
});

test('a failing registration is reported as failed', async () => {
  mockApi({ 'POST /devices': { status: 500, body: { message: 'Server Error' } } });
  await expect(enablePush()).resolves.toBe('failed');
  expect(await isPushEnabled()).toBe(false);
});

test('disabling forgets the token on the server', async () => {
  mockApi({ 'POST /devices': { status: 204 } });
  await enablePush();
  const calls = mockApi({ 'DELETE /devices/ExponentPushToken%5Btest%5D': { status: 204 } });

  await disablePush();

  expect(calls[0]).toMatchObject({ method: 'DELETE', path: '/devices/ExponentPushToken%5Btest%5D' });
  expect(await isPushEnabled()).toBe(false);
});

test('the prompt is offered once', async () => {
  expect(await shouldOfferPush()).toBe(true);
  await markPushOffered();
  expect(await shouldOfferPush()).toBe(false);
});
