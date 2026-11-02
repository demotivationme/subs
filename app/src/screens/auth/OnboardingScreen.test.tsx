import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import '@/i18n';
import { prefs } from '@/lib/prefs';
import { renderWithProviders } from '@/test/utils';

import OnboardingScreen from './OnboardingScreen';

beforeEach(async () => {
  jest.clearAllMocks();
  await prefs.remove('onboarding.seen');
});

test('starts on the first slide without Back and does not mark onboarding seen', async () => {
  await renderWithProviders(<OnboardingScreen />);
  expect(screen.getByText('All your subscriptions, one number.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  expect(await prefs.get('onboarding.seen')).toBeNull();
});

test('Next and Back move between slides; reaching the last slide marks onboarding seen', async () => {
  await renderWithProviders(<OnboardingScreen />);

  await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByText('Add one in seconds.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByText('All your subscriptions, one number.')).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByText('Know before you pay.')).toBeTruthy();
  expect(await prefs.get('onboarding.seen')).toBeNull();

  await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByText('Keep only what you use.')).toBeTruthy();
  await waitFor(async () => expect(await prefs.get('onboarding.seen')).toBe('1'));
});

test('Skip jumps to the last slide and marks onboarding seen', async () => {
  await renderWithProviders(<OnboardingScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
  expect(screen.getByText('Keep only what you use.')).toBeTruthy();
  await waitFor(async () => expect(await prefs.get('onboarding.seen')).toBe('1'));
});

test('Get started goes to register and I already have an account goes to log in', async () => {
  await renderWithProviders(<OnboardingScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));

  await fireEvent.press(screen.getByRole('button', { name: 'Get started' }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/register'));
  expect(await prefs.get('onboarding.seen')).toBe('1');

  await fireEvent.press(screen.getByRole('button', { name: 'I already have an account' }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
});
