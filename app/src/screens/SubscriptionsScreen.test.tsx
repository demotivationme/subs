import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { fixtures } from '@/test/fixtures';
import { mockApi, renderWithProviders } from '@/test/utils';

import SubscriptionsScreen from './SubscriptionsScreen';

function routes() {
  return {
    'GET /categories': { body: { data: [fixtures.category(), fixtures.category({ id: 3, key: 'music', label: 'Music' })] } },
    'GET /subscriptions': {
      body: {
        data: [
          fixtures.subscription(),
          fixtures.subscription({
            id: 6,
            service: { id: 4, name: 'Spotify', logo_url: null, color: null },
            category: { id: 3, label: 'Music', icon: null, color: null },
            amount: 1099,
            interval_count: 3,
            status: 'paused',
          }),
        ],
      },
    },
  };
}

test('lists subscriptions with price, period, next date and status', async () => {
  mockApi(routes());
  await renderWithProviders(<SubscriptionsScreen />);

  expect(await screen.findByText('Netflix')).toBeTruthy();
  expect(screen.getByText('€12.99')).toBeTruthy();
  expect(screen.getByText('monthly')).toBeTruthy();
  expect(screen.getByText('€10.99')).toBeTruthy();
  expect(screen.getByText('every 3 months')).toBeTruthy();
  expect(screen.getByText('Video Streaming · Next Nov 15, 2026')).toBeTruthy();
  expect(screen.getByText('Music · Next Nov 15, 2026')).toBeTruthy();
});

test('a paused row shows its status pill, is dimmed and says so in its label', async () => {
  mockApi(routes());
  await renderWithProviders(<SubscriptionsScreen />);
  await screen.findByText('Netflix');

  expect(screen.getByText('Paused')).toBeTruthy();
  expect(screen.queryByText('Active')).toBeNull();
  const paused = screen.getByRole('button', { name: 'Spotify, €10.99 every 3 months, Paused' });
  const active = screen.getByRole('button', { name: 'Netflix, €12.99 monthly, Active' });
  expect(screen.getByTestId('subscription-row-6')).toHaveStyle({ opacity: 0.72 });
  expect(screen.getByTestId('subscription-row-5')).not.toHaveStyle({ opacity: 0.72 });
  expect(paused).toBeTruthy();
  expect(active).toBeTruthy();
});

test('sorts and filters through the API', async () => {
  const calls = mockApi(routes());
  await renderWithProviders(<SubscriptionsScreen />);
  await screen.findByText('Netflix');

  await fireEvent.press(screen.getByRole('radio', { name: 'Price' }));
  await waitFor(() => expect(calls.some((c) => c.path === '/subscriptions?sort=price')).toBe(true));

  await fireEvent.press(screen.getByRole('button', { name: 'Status' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Paused' }));
  await waitFor(() => expect(calls.some((c) => c.path === '/subscriptions?sort=price&status=paused')).toBe(true));

  await fireEvent.press(screen.getByRole('button', { name: 'Category' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Music' }));
  await waitFor(() => expect(calls.some((c) => c.path === '/subscriptions?sort=price&status=paused&category_id=3')).toBe(true));
});

test('opens a subscription', async () => {
  mockApi(routes());
  await renderWithProviders(<SubscriptionsScreen />);

  await fireEvent.press(await screen.findByRole('button', { name: 'Netflix, €12.99 monthly, Active' }));
  expect(router.push).toHaveBeenCalledWith('/subscriptions/5');
});

test('shows the empty state', async () => {
  mockApi({ ...routes(), 'GET /subscriptions': { body: { data: [] } } });
  await renderWithProviders(<SubscriptionsScreen />);

  expect(await screen.findByText('No subscriptions match.')).toBeTruthy();
});
