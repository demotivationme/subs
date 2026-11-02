import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { fixtures } from '@/test/fixtures';
import { mockApi, renderWithProviders } from '@/test/utils';

import CategoriesScreen from './CategoriesScreen';

const custom = fixtures.category({ id: 40, key: null, label: 'Kids', is_custom: true });

function setup(overrides: Parameters<typeof mockApi>[0] = {}) {
  return mockApi({
    'GET /categories': { body: { data: [fixtures.category(), custom] } },
    'POST /categories': { status: 201, body: { data: fixtures.category({ id: 41, key: null, label: 'Pets', is_custom: true }) } },
    'PATCH /categories/40': { body: { data: { ...custom, label: 'Children' } } },
    'DELETE /categories/40': { status: 204 },
    ...overrides,
  });
}

/** Makes every request with this method hang, to observe the pending state. */
function hang(method: string) {
  const real = global.fetch;
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) =>
    (init?.method ?? 'GET') === method ? new Promise<Response>(() => undefined) : real(input, init),
  ) as typeof fetch;
}

test('presets are read-only; custom ones can be renamed and deleted', async () => {
  const calls = setup();
  await renderWithProviders(<CategoriesScreen />);

  expect(await screen.findByText('Video Streaming')).toBeTruthy();
  expect(screen.getAllByRole('button', { name: 'Rename' })).toHaveLength(1);

  await fireEvent.press(screen.getByRole('button', { name: 'Rename' }));
  await fireEvent.changeText(screen.getByLabelText('Category name'), 'Children');
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ name: 'Children' }));

  await fireEvent.press(await screen.findByRole('button', { name: 'Delete' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Tap again to delete' }));
  await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.path === '/categories/40')).toBe(true));
});

test('adds a category', async () => {
  const calls = setup();
  await renderWithProviders(<CategoriesScreen />);

  await fireEvent.changeText(await screen.findByLabelText('Add category'), '  Pets ');
  await fireEvent.press(screen.getByRole('button', { name: 'Add' }));

  await waitFor(() => expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ name: 'Pets' }));
});

test('a failed delete disarms the confirmation and shows the error', async () => {
  setup({ 'DELETE /categories/40': { status: 403, body: { message: 'Could not delete it.' } } });
  await renderWithProviders(<CategoriesScreen />);

  await fireEvent.press(await screen.findByRole('button', { name: 'Delete' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Tap again to delete' }));

  expect(await screen.findByText('Could not delete it.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Tap again to delete' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
});

test('the add button is disabled while the request is pending', async () => {
  setup();
  await renderWithProviders(<CategoriesScreen />);
  await fireEvent.changeText(await screen.findByLabelText('Add category'), 'Pets');
  hang('POST');

  await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled());
});

test('the save button is disabled while the rename is pending', async () => {
  setup();
  await renderWithProviders(<CategoriesScreen />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Rename' }));
  await fireEvent.changeText(screen.getByLabelText('Category name'), 'Children');
  hang('PATCH');

  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled());
});
