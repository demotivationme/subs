import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { keys } from '@/api/keys';
import { fixtures } from '@/test/fixtures';
import { createTestQueryClient, mockApi, renderWithProviders } from '@/test/utils';

import DashboardScreen from './DashboardScreen';

// Fake only Date so "today" is fixed (Berlin: 2026-11-02) while timers and promises keep running.
beforeEach(() => {
  jest.useFakeTimers({
    now: new Date('2026-11-02T12:00:00Z'),
    doNotFake: [
      'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate',
      'nextTick', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame',
      'requestIdleCallback', 'cancelIdleCallback', 'performance', 'hrtime',
    ],
  });
});
afterEach(() => jest.useRealTimers());

function withMe(user = fixtures.user()) {
  const client = createTestQueryClient();
  client.setQueryData(keys.me, user);
  return client;
}

test('shows the hero totals, the category breakdown and the most expensive', async () => {
  mockApi({ 'GET /dashboard': { body: fixtures.dashboard() } });
  await renderWithProviders(<DashboardScreen />, withMe());

  expect(await screen.findByText('You spend per month')).toBeTruthy();
  expect(screen.getByText('€87.34')).toBeTruthy();
  expect(screen.getByText('€1,048.08 / year')).toBeTruthy();
  expect(screen.getByText('2 active')).toBeTruthy();
  expect(screen.getByLabelText('Monthly spend by category')).toBeTruthy();
  expect(screen.getByLabelText('Video Streaming: €57.35, 65.7%')).toBeTruthy();
  expect(screen.getByLabelText('Music: €29.99, 34.3%')).toBeTruthy();
  expect(screen.getByText('€44.36 / month')).toBeTruthy();
});

test('upcoming payments show a date tile and a relative subtitle, and open the subscription', async () => {
  mockApi({ 'GET /dashboard': { body: fixtures.dashboard() } });
  await renderWithProviders(<DashboardScreen />, withMe());

  expect(await screen.findByText('NOV')).toBeTruthy();
  expect(screen.getByText('15')).toBeTruthy();
  expect(screen.getByText('In 13 days')).toBeTruthy();
  expect(screen.getByText('€12.99')).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Netflix' }));
  expect(router.push).toHaveBeenCalledWith('/subscriptions/5');
});

test('relative subtitles say Today and Tomorrow, using the account timezone', async () => {
  const upcoming = [
    { subscription_id: 1, name: 'Gym', date: '2026-11-02', amount: 1000, currency: 'EUR' },
    { subscription_id: 2, name: 'Cloud', date: '2026-11-03', amount: 500, currency: 'EUR' },
  ];
  mockApi({ 'GET /dashboard': { body: fixtures.dashboard({ upcoming }) } });
  await renderWithProviders(<DashboardScreen />, withMe());

  expect(await screen.findByText('Today')).toBeTruthy();
  expect(screen.getByText('Tomorrow')).toBeTruthy();
});

test('"See all" opens the subscriptions tab', async () => {
  mockApi({ 'GET /dashboard': { body: fixtures.dashboard() } });
  await renderWithProviders(<DashboardScreen />, withMe());

  await fireEvent.press(await screen.findByRole('link', { name: 'See all' }));
  expect(router.push).toHaveBeenCalledWith('/subscriptions');
});

test('warns about subscriptions left out of the totals', async () => {
  mockApi({ 'GET /dashboard': { body: fixtures.dashboard({ unconverted: [{ subscription_id: 9, currency: 'XYZ' }] }) } });
  await renderWithProviders(<DashboardScreen />, withMe());

  expect(await screen.findByText("1 subscription uses a currency without an exchange rate and isn't included in the totals.")).toBeTruthy();
});

test('invites the first subscription when there are none', async () => {
  mockApi({ 'GET /dashboard': { body: fixtures.dashboard({ count: 0, monthly_total: 0, yearly_total: 0, by_category: [], upcoming: [], most_expensive: [] }) } });
  await renderWithProviders(<DashboardScreen />, withMe());

  await fireEvent.press(await screen.findByRole('button', { name: 'Add a subscription' }));
  expect(router.push).toHaveBeenCalledWith('/subscriptions/new');
});

test('asks unverified users to verify and resends the email', async () => {
  const calls = mockApi({ 'GET /dashboard': { body: fixtures.dashboard() }, 'POST /auth/email/resend': { status: 204 } });
  await renderWithProviders(<DashboardScreen />, withMe(fixtures.user({ email_verified: false })));

  await fireEvent.press(await screen.findByRole('button', { name: 'Resend email' }));

  expect(await screen.findByText('Verification email sent.')).toBeTruthy();
  expect(calls.some((c) => c.method === 'POST' && c.path === '/auth/email/resend')).toBe(true);
});

test('offers a retry when loading fails', async () => {
  mockApi({ 'GET /dashboard': { status: 500, body: { message: 'Server Error' } } });
  await renderWithProviders(<DashboardScreen />, withMe());

  expect(await screen.findByText('Something went wrong. Please try again.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
});
