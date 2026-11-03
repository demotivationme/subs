import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'subs.pref.';

/** Per-device choices that outlive an account session. */
const KEEP: readonly PrefKey[] = ['onboarding.seen', 'theme'];

export type PrefKey = 'push.enabled' | 'push.token' | 'push.asked' | 'onboarding.seen' | 'theme';

/** Small per-device settings that are not account data. */
export const prefs = {
  get: (key: PrefKey) => AsyncStorage.getItem(PREFIX + key),
  set: (key: PrefKey, value: string) => AsyncStorage.setItem(PREFIX + key, value),
  remove: (key: PrefKey) => AsyncStorage.removeItem(PREFIX + key),
  async clear(): Promise<void> {
    // Onboarding and the theme are per device, not per account, so signing out keeps them.
    const keep = KEEP.map((key) => PREFIX + key);
    const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(PREFIX) && !keep.includes(key));
    await AsyncStorage.multiRemove(keys);
  },
};
