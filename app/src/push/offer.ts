import { prefs } from '@/lib/prefs';

import { isPushEnabled, isPushSupported } from '.';

/** The explanation screen is shown once, after the first saved subscription (spec §8). */
export async function shouldOfferPush(): Promise<boolean> {
  return isPushSupported() && (await prefs.get('push.asked')) !== '1' && !(await isPushEnabled());
}

export async function markPushOffered(): Promise<void> {
  await prefs.set('push.asked', '1');
}
