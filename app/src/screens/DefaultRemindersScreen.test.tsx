import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { fixtures } from '@/test/fixtures';
import { createTestQueryClient, mockApi, renderWithProviders } from '@/test/utils';

import DefaultRemindersScreen from './DefaultRemindersScreen';

test('saves the default reminders and goes back', async () => {
  const calls = mockApi({
    'GET /me': { body: { data: fixtures.user() } },
    'GET /reminder-defaults': { body: { data: [fixtures.rule()] } },
    'PUT /reminder-defaults': { body: { data: [fixtures.rule({ days_before: 7 })] } },
  });
  await renderWithProviders(<DefaultRemindersScreen />, createTestQueryClient());

  await fireEvent.press(await screen.findByRole('radio', { name: '7 days' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() =>
    expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ rules: [{ days_before: 7, time_of_day: '09:00', channels: ['push', 'in_app'] }] }),
  );
  await waitFor(() => expect(router.back).toHaveBeenCalled());
});
