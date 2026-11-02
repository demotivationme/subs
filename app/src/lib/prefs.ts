import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'subs.pref.';

export type PrefKey = 'push.enabled' | 'push.token' | 'push.asked';

/** Small per-device settings that are not account data. */
export const prefs = {
  get: (key: PrefKey) => AsyncStorage.getItem(PREFIX + key),
  set: (key: PrefKey, value: string) => AsyncStorage.setItem(PREFIX + key, value),
  remove: (key: PrefKey) => AsyncStorage.removeItem(PREFIX + key),
  async clear(): Promise<void> {
    const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(PREFIX));
    await AsyncStorage.multiRemove(keys);
  },
};
