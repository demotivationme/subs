import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { fixtures } from '@/test/fixtures';
import { mockApi, renderWithProviders } from '@/test/utils';

import InboxScreen from './InboxScreen';

const unread = fixtures.notification();
const read = fixtures.notification({ id: 'read-1', title: 'Spotify renews in 7 days', subscription_id: 6, read_at: '2026-11-01T10:00:00+00:00' });
const page = (data: unknown[], current = 1, last = 1) => ({ body: { data, meta: { current_page: current, last_page: last, total: data.length } } });

test('lists notifications with unread and read styling and opens the subscription', async () => {
  const calls = mockApi({
    'GET /notifications': page([unread, read]),
    [`POST /notifications/${unread.id}/read`]: { status: 204 },
  });
  await renderWithProviders(<InboxScreen />);

  expect(await screen.findByText('Netflix renews tomorrow')).toBeTruthy();
  expect(screen.getAllByLabelText('Unread')).toHaveLength(1);
  expect(screen.getAllByTestId('inbox-row-unread')).toHaveLength(1);
  expect(screen.getAllByTestId('inbox-row-read')).toHaveLength(1);
  expect(screen.getByTestId('inbox-row-unread').props.className).toContain('bg-surface');
  expect(screen.getByTestId('inbox-row-read').props.className).toContain('border-line');

  await fireEvent.press(screen.getByRole('button', { name: /Netflix renews tomorrow/ }));

  expect(router.push).toHaveBeenCalledWith('/subscriptions/5');
  await waitFor(() => expect(calls.some((c) => c.path === `/notifications/${unread.id}/read`)).toBe(true));
});

test('the row label announces title, body and time', async () => {
  mockApi({ 'GET /notifications': page([unread]) });
  await renderWithProviders(<InboxScreen />);

  const row = await screen.findByRole('button', { name: /Netflix renews tomorrow/ });
  const label = String(row.props.accessibilityLabel);
  expect(label).toContain('Netflix renews tomorrow');
  expect(label).toContain('€12.99 on Nov 15, 2026');
  expect(label).toMatch(/2026/);
});

test('opening a read notification does not mark it again', async () => {
  const calls = mockApi({ 'GET /notifications': page([read]) });
  await renderWithProviders(<InboxScreen />);

  await fireEvent.press(await screen.findByRole('button', { name: /Spotify renews in 7 days/ }));

  expect(router.push).toHaveBeenCalledWith('/subscriptions/6');
  expect(calls.some((c) => c.method === 'POST')).toBe(false);
});

test('marks everything read', async () => {
  const calls = mockApi({ 'GET /notifications': page([unread]), 'POST /notifications/read-all': { status: 204 } });
  await renderWithProviders(<InboxScreen />);

  await fireEvent.press(await screen.findByRole('button', { name: 'Mark all as read' }));

  await waitFor(() => expect(calls.some((c) => c.path === '/notifications/read-all')).toBe(true));
});

test('hides mark all as read when nothing is unread', async () => {
  mockApi({ 'GET /notifications': page([read]) });
  await renderWithProviders(<InboxScreen />);

  await screen.findByText('Spotify renews in 7 days');
  expect(screen.queryByRole('button', { name: 'Mark all as read' })).toBeNull();
});

test('loads the next page at the end of the list', async () => {
  const calls = mockApi({
    'GET /notifications?page=1': page([unread], 1, 2),
    'GET /notifications?page=2': page([read], 2, 2),
  });
  await renderWithProviders(<InboxScreen />);
  await screen.findByText('Netflix renews tomorrow');

  await fireEvent(screen.getByTestId('inbox-list'), 'endReached');

  expect(await screen.findByText('Spotify renews in 7 days')).toBeTruthy();
  expect(calls.some((c) => c.path === '/notifications?page=2')).toBe(true);
});

test('shows an empty inbox', async () => {
  mockApi({ 'GET /notifications': page([]) });
  await renderWithProviders(<InboxScreen />);

  expect(await screen.findByText('No notifications yet.')).toBeTruthy();
});
