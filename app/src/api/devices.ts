import { api } from './client';
import type { DevicePlatform } from './types';

export type WebPushBody = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  content_encoding: 'aesgcm' | 'aes128gcm';
};

export const devicesApi = {
  register: (token: string, platform: DevicePlatform) => api<void>('/devices', { method: 'POST', body: { token, platform } }),
  unregister: (token: string) => api<void>(`/devices/${encodeURIComponent(token)}`, { method: 'DELETE' }),
  webPushSubscribe: (body: WebPushBody) => api<void>('/webpush/subscribe', { method: 'POST', body }),
  webPushUnsubscribe: (endpoint: string) => api<void>('/webpush/subscribe', { method: 'DELETE', body: { endpoint } }),
};
