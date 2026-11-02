import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'subs.pref.';

const KEEP: PrefKey = 'onboarding.seen';

export type PrefKey = 'push.enabled' | 'push.token' | 'push.asked' | 'onboarding.seen';

/** Small per-device settings that are not account data. */
export const prefs = {
  get: (key: PrefKey) => AsyncStorage.getItem(PREFIX + key),
  set: (key: PrefKey, value: string) => AsyncStorage.setItem(PREFIX + key, value),
  remove: (key: PrefKey) => AsyncStorage.removeItem(PREFIX + key),
  async clear(): Promise<void> {
    // Onboarding is per device, not per account, so signing out must not replay it.
    const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(PREFIX) && key !== PREFIX + KEEP);
    await AsyncStorage.multiRemove(keys);
  },
};
