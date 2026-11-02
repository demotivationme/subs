import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { mockApi, renderWithProviders } from '@/test/utils';

import { HeaderBell } from './HeaderBell';

test('shows the unread count and opens the inbox', async () => {
  mockApi({ 'GET /notifications/unread-count': { body: { count: 3 } } });
  await renderWithProviders(<HeaderBell />);

  await fireEvent.press(await screen.findByRole('button', { name: 'Notifications, 3 unread' }));

  expect(screen.getByText('3')).toBeTruthy();
  expect(router.push).toHaveBeenCalledWith('/notifications');
});

test('shows no badge when everything is read', async () => {
  mockApi({ 'GET /notifications/unread-count': { body: { count: 0 } } });
  await renderWithProviders(<HeaderBell />);

  expect(await screen.findByRole('button', { name: 'Notifications, 0 unread' })).toBeTruthy();
  expect(screen.queryByText('0')).toBeNull();
});

test('caps the badge at 99+', async () => {
  mockApi({ 'GET /notifications/unread-count': { body: { count: 120 } } });
  await renderWithProviders(<HeaderBell />);

  expect(await screen.findByText('99+')).toBeTruthy();
});
