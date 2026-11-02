import { render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { prefs } from '@/lib/prefs';

import StartScreen from './StartScreen';

beforeEach(async () => {
  jest.clearAllMocks();
  await prefs.remove('onboarding.seen');
});

test('first run goes to the welcome slides', async () => {
  await render(<StartScreen />);
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/welcome'));
});

test('after onboarding it goes to log in', async () => {
  await prefs.set('onboarding.seen', '1');
  await render(<StartScreen />);
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
});
