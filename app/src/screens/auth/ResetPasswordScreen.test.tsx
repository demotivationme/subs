import { fireEvent, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { mockApi, renderWithProviders } from '@/test/utils';

import ResetPasswordScreen from './ResetPasswordScreen';

test('explains an incomplete link', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({});
  await renderWithProviders(<ResetPasswordScreen />);
  expect(screen.getByText('This reset link is incomplete. Request a new one.')).toBeTruthy();
});

test('sets the new password with the token and email from the link', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ token: 'abc', email: 'ana@example.com' });
  const calls = mockApi({ 'POST /auth/reset-password': { body: { message: 'Your password has been reset.' } } });
  await renderWithProviders(<ResetPasswordScreen />);

  await fireEvent.changeText(screen.getByLabelText('New password'), 'newsecret1');
  await fireEvent.press(screen.getByRole('button', { name: 'Set new password' }));

  expect(await screen.findByText('Your password has been reset.')).toBeTruthy();
  expect(calls[0].body).toEqual({ token: 'abc', email: 'ana@example.com', password: 'newsecret1' });

  await fireEvent.press(screen.getByRole('button', { name: 'Back to log in' }));
  expect(router.replace).toHaveBeenCalledWith('/login');
});
