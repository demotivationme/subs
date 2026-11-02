import AsyncStorage from '@react-native-async-storage/async-storage';

import { prefs } from './prefs';

test('clear removes only Subs prefs', async () => {
  await AsyncStorage.setItem('other', 'keep');
  await prefs.set('push.enabled', '1');
  await prefs.clear();
  expect(await prefs.get('push.enabled')).toBeNull();
  expect(await AsyncStorage.getItem('other')).toBe('keep');
});
