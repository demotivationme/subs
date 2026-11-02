import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import { devicesApi } from '@/api/devices';
import { prefs } from '@/lib/prefs';

import type { PushResult } from './types';

export type { PushResult } from './types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function projectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

export function isPushSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

/** Asks permission if needed and registers this device's Expo token with the API. Never throws. */
export async function enablePush(): Promise<PushResult> {
  const id = projectId();
  if (!isPushSupported() || !id) return 'unsupported';

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: AndroidImportance.DEFAULT,
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== 'granted') {
      await prefs.set('push.enabled', '0');
      return 'denied';
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    await devicesApi.register(token, Platform.OS === 'ios' ? 'ios' : 'android');
    await prefs.set('push.token', token);
    await prefs.set('push.enabled', '1');
    return 'enabled';
  } catch {
    await prefs.set('push.enabled', '0').catch(() => undefined);
    return 'failed';
  }
}

export async function disablePush(): Promise<void> {
  const token = await prefs.get('push.token');
  if (token) await devicesApi.unregister(token).catch(() => undefined);
  await prefs.remove('push.token');
  await prefs.set('push.enabled', '0');
}

export async function isPushEnabled(): Promise<boolean> {
  return (await prefs.get('push.enabled')) === '1';
}
