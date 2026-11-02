import { devicesApi } from '@/api/devices';
import { prefs } from '@/lib/prefs';

import type { PushResult } from './types';

export type { PushResult } from './types';

const VAPID_PUBLIC_KEY = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY ?? '';

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function isPushSupported(): boolean {
  return (
    VAPID_PUBLIC_KEY !== '' &&
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** Subscribes this browser through the service worker and sends the subscription to the API. Never throws. */
export async function enablePush(): Promise<PushResult> {
  if (!isPushSupported()) return 'unsupported';

  try {
    // Never prompt again once the user has answered; a re-register on start must be silent.
    const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    if (permission !== 'granted') {
      await prefs.set('push.enabled', '0');
      return 'denied';
    }

    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) }));

    const json = subscription.toJSON();
    await devicesApi.webPushSubscribe({
      endpoint: subscription.endpoint,
      keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
      content_encoding: 'aes128gcm',
    });
    await prefs.set('push.enabled', '1');
    return 'enabled';
  } catch {
    // Transient failures keep the flag so the next start retries.
    return 'failed';
  }
}

/** Never throws; always ends with push off. */
export async function disablePush(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker?.getRegistration('/sw.js');
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      await devicesApi.webPushUnsubscribe(subscription.endpoint).catch(() => undefined);
      await subscription.unsubscribe();
    }
  } catch {
    // Best effort: the browser subscription may already be gone.
  }
  try {
    await prefs.set('push.enabled', '0');
  } catch {
    // Nothing left to do.
  }
}

export async function isPushEnabled(): Promise<boolean> {
  return (await prefs.get('push.enabled')) === '1';
}
