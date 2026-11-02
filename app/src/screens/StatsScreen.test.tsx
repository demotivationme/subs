import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { useSession } from '@/auth/session';
import { keys } from '@/api/keys';
import { fixtures } from '@/test/fixtures';
import { createTestQueryClient, mockApi, renderWithProviders } from '@/test/utils';

import StatsScreen from './StatsScreen';

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
afterEach(() => {
  jest.useRealTimers();
  useSession.setState({ status: 'loading', token: null });
});

function withMe() {
  const client = createTestQueryClient();
  client.setQueryData(keys.me, fixtures.user());
  return client;
}

const payments = [
  { subscription_id: 5, name: 'Netflix', date: '2026-11-05', amount: 1299, currency: 'EUR', converted: 1299, state: 'paid' as const },
  { subscription_id: 6, name: 'Figma', date: '2026-11-20', amount: 1500, currency: 'USD', converted: 1380, state: 'expected' as const },
];

function statsRoutes() {
  return mockApi({
    'GET /stats': ({ path }) => {
      const params = new URLSearchParams(path.split('?')[1]);
      const year = Number(params.get('year'));
      return { body: fixtures.stats({ year, ...(params.get('month') ? { payments } : {}) }) };
    },
  });
}

test('year view shows the totals, the current-month bubble and one chart summary', async () => {
  statsRoutes();
  await renderWithProviders(<StatsScreen />, withMe());

  expect(await screen.findByText('Spent in 2026 so far')).toBeTruthy();
  expect(screen.getByText('€880.67')).toBeTruthy();
  expect(screen.getByText('On track for €968.01 this year')).toBeTruthy();
  expect(screen.getByTestId('bubble').props.children).toBe('€128.34');
  expect(screen.getByLabelText(/^Spend per month in 2026/)).toBeTruthy();
  expect(screen.getByText('Paid')).toBeTruthy();
  expect(screen.getByText('Expected')).toBeTruthy();
});

test('previous and next year refetch with year=, and next is disabled at the current year', async () => {
  const calls = statsRoutes();
  await renderWithProviders(<StatsScreen />, withMe());
  await screen.findByText('Spent in 2026 so far');

  expect(screen.getByRole('button', { name: 'Next year' }).props.accessibilityState?.disabled).toBe(true);
  await fireEvent.press(screen.getByRole('button', { name: 'Previous year' }));
  expect(await screen.findByText('Spent in 2025 so far')).toBeTruthy();
  expect(calls.some((c) => c.path === '/stats?year=2025')).toBe(true);

  await fireEvent.press(screen.getByRole('button', { name: 'Next year' }));
  await waitFor(() => expect(screen.getByText('Spent in 2026 so far')).toBeTruthy());
});

test('month view requests month= and lists payments including the expected ones', async () => {
  const calls = statsRoutes();
  await renderWithProviders(<StatsScreen />, withMe());
  await screen.findByText('Spent in 2026 so far');

  await fireEvent.press(screen.getByRole('radio', { name: 'Month' }));
  expect(await screen.findByText('Netflix')).toBeTruthy();
  expect(calls.some((c) => c.path === '/stats?year=2026&month=11')).toBe(true);
  expect(screen.getByText('November 2026')).toBeTruthy();
  expect(screen.getByText('€128.34')).toBeTruthy();
  expect(screen.getByText('Nov 5, 2026')).toBeTruthy();
  expect(screen.getByText('€12.99')).toBeTruthy();
  expect(screen.getByText('$15.00')).toBeTruthy();
  expect(screen.getByText('€13.80')).toBeTruthy();
  expect(screen.getAllByText('Expected').length).toBeGreaterThan(0);
});

test('a payment in an unconverted currency shows only its original amount', async () => {
  const odd = [{ subscription_id: 8, name: 'Odd', date: '2026-11-09', amount: 500, currency: 'XYZ', converted: null, state: 'paid' as const }];
  mockApi({ 'GET /stats': { body: fixtures.stats({ payments: odd }) } });
  await renderWithProviders(<StatsScreen />, withMe());
  await fireEvent.press(await screen.findByRole('radio', { name: 'Month' }));
  expect(await screen.findByText('Odd')).toBeTruthy();
  expect(screen.getAllByText(/XYZ/)).toHaveLength(1);
  const row = within(screen.getByTestId('payment-8'));
  expect(row.getAllByText(/\d/).filter((n) => /\d[.,]\d{2}/.test(String(n.props.children)))).toHaveLength(1);
});

test('month navigation crosses the year boundary in both directions', async () => {
  const calls = statsRoutes();
  await renderWithProviders(<StatsScreen />, withMe());
  await fireEvent.press(await screen.findByRole('radio', { name: 'Month' }));
  await screen.findByText('November 2026');

  for (let i = 0; i < 10; i++) await fireEvent.press(screen.getByRole('button', { name: 'Previous month' }));
  expect(await screen.findByText('January 2026')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Previous month' }));
  expect(await screen.findByText('December 2025')).toBeTruthy();
  expect(calls.some((c) => c.path === '/stats?year=2025&month=12')).toBe(true);

  const before = calls.length;
  await fireEvent.press(screen.getByRole('button', { name: 'Next month' }));
  expect(await screen.findByText('January 2026')).toBeTruthy();
  expect(calls.slice(before).map((c) => c.path)).toContain('/stats?year=2026&month=1');
});

test('the chart summary is its own element and every month bar stays a separate button', async () => {
  statsRoutes();
  await renderWithProviders(<StatsScreen />, withMe());
  await screen.findByText('Spent in 2026 so far');

  const summary = screen.getByLabelText(/^Spend per month in 2026/);
  expect(summary).toBe(screen.getByTestId('chart-summary'));
  expect(screen.getAllByRole('button', { name: /2026/ })).toHaveLength(12);
  expect(within(summary).getByText('€880.67')).toBeTruthy();
  expect(within(summary).queryAllByRole('button')).toHaveLength(0);
  for (const bar of screen.getAllByRole('button', { name: /2026/ })) expect(within(summary).queryByLabelText(bar.props.accessibilityLabel)).toBeNull();
});

test('the initial month follows the account timezone once /me arrives', async () => {
  // 2026-12-31 20:00Z is already 2027-01-01 in Auckland.
  jest.setSystemTime(new Date('2026-12-31T20:00:00Z'));
  useSession.setState({ status: 'signedIn', token: 'tok' });
  const calls = mockApi({
    'GET /me': { body: { data: fixtures.user({ timezone: 'Pacific/Auckland' }) } },
    'GET /stats': ({ path }) => ({ body: fixtures.stats({ year: Number(new URLSearchParams(path.split('?')[1]).get('year')) }) }),
  });
  await renderWithProviders(<StatsScreen />);

  expect(await screen.findByText('Spent in 2027 so far')).toBeTruthy();
  expect(calls.some((c) => c.path === '/stats?year=2027')).toBe(true);
});

test('pressing a bar jumps to that month', async () => {
  const calls = statsRoutes();
  await renderWithProviders(<StatsScreen />, withMe());
  await screen.findByText('Spent in 2026 so far');

  await fireEvent.press(screen.getByRole('button', { name: /^March 2026/ }));
  expect(await screen.findByText('March 2026')).toBeTruthy();
  expect(calls.some((c) => c.path === '/stats?year=2026&month=3')).toBe(true);
});

test('the savings card lists items, labels resumed ones and shows the keep line', async () => {
  const base = fixtures.stats();
  mockApi({
    'GET /stats': {
      body: fixtures.stats({
        savings: {
          ...base.savings,
          items: [
            ...base.savings.items,
            { subscription_id: 10, name: 'Spotify', service: null, status: 'paused', since: '2026-03-01', until: '2026-05-01', monthly: 999, saved: 1998 },
          ],
        },
      }),
    },
  });
  await renderWithProviders(<StatsScreen />, withMe());

  expect(await screen.findByText('Saved by cancelling')).toBeTruthy();
  expect(screen.getByText('€61.94')).toBeTruthy();
  expect(screen.getByText('You now keep €21.98 a month — €263.76 a year')).toBeTruthy();
  expect(screen.getByText('Cancelled Aug 1, 2026 · €8.99/mo')).toBeTruthy();
  expect(screen.getByText('+€35.96')).toBeTruthy();
  expect(screen.getByText('Paused Mar 1, 2026 – May 1, 2026')).toBeTruthy();
});

test('the savings card shows an empty hint without items', async () => {
  mockApi({ 'GET /stats': { body: fixtures.stats({ savings: { total: 0, monthly: 0, yearly: 0, items: [] } }) } });
  await renderWithProviders(<StatsScreen />, withMe());
  expect(await screen.findByText("Cancel or pause something you don't use and your savings show up here.")).toBeTruthy();
});

test('category changes use minus, plus and plus-minus signs', async () => {
  mockApi({ 'GET /stats': { body: fixtures.stats() } });
  await renderWithProviders(<StatsScreen />, withMe());

  await screen.findByText('Saved by cancelling');
  const row = (label: string) => within(screen.getByLabelText(new RegExp(`^${label}`)));
  expect(row('Video Streaming').getByText('−€8.99')).toBeTruthy();
  expect(row('Music').getByText('+€5.00')).toBeTruthy();
  expect(row('Cloud').getByText('±0')).toBeTruthy();
});

test('shows the biggest expense, the next 12 months and the unconverted warning', async () => {
  mockApi({ 'GET /stats': { body: fixtures.stats({ unconverted: [{ subscription_id: 3, currency: 'XYZ' }] }) } });
  await renderWithProviders(<StatsScreen />, withMe());

  expect(await screen.findByText('Adobe CC')).toBeTruthy();
  expect(screen.getByText('€19.99 / month')).toBeTruthy();
  expect(screen.getByText('€1,048.08')).toBeTruthy();
  expect(screen.getByText('if nothing changes')).toBeTruthy();
  expect(screen.getByText(/uses a currency without an exchange rate/)).toBeTruthy();
});
