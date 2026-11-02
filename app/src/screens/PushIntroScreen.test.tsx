import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { enablePush } from '@/push';
import { shouldOfferPush } from '@/push/offer';
import { renderWithProviders } from '@/test/utils';

import PushIntroScreen from './PushIntroScreen';

jest.mock('@/push', () => ({
  enablePush: jest.fn(),
  disablePush: jest.fn(),
  isPushEnabled: jest.fn(async () => false),
  isPushSupported: jest.fn(() => true),
}));

test('turning on closes the prompt when granted', async () => {
  jest.mocked(enablePush).mockResolvedValue('enabled');
  await renderWithProviders(<PushIntroScreen />);

  await fireEvent.press(screen.getByRole('button', { name: 'Turn on notifications' }));

  expect(router.back).toHaveBeenCalled();
  expect(await shouldOfferPush()).toBe(false);
});

test('explains a denied permission and lets the user continue', async () => {
  jest.mocked(enablePush).mockResolvedValue('denied');
  await renderWithProviders(<PushIntroScreen />);

  await fireEvent.press(screen.getByRole('button', { name: 'Turn on notifications' }));

  expect(await screen.findByText('Notifications are blocked. You can allow them later in Settings.')).toBeTruthy();
  expect(router.back).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
  expect(router.back).toHaveBeenCalled();
});
