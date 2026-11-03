import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { keys } from '@/api/keys';
import { useSession } from '@/auth/session';
import { todayIso } from '@/lib/dates';
import { prefs } from '@/lib/prefs';
import { fixtures } from '@/test/fixtures';
import { createTestQueryClient, mockApi, renderWithProviders, type MockRoute } from '@/test/utils';

import NewSubscriptionScreen from './NewSubscriptionScreen';

const SAVE = 'Save subscription';

function setup(extra: Record<string, MockRoute> = {}) {
  const calls = mockApi({
    'GET /categories': { body: { data: [fixtures.category(), fixtures.category({ id: 3, key: 'music', label: 'Music' })] } },
    'GET /reminder-defaults': { body: { data: [fixtures.rule()] } },
    'GET /services': { body: { data: [fixtures.service(), fixtures.service({ id: 4, name: 'Spotify', default_category_id: 3 })] } },
    'POST /subscriptions': { status: 201, body: { data: fixtures.subscription({ id: 11 }) } },
    ...extra,
  });
  const client = createTestQueryClient();
  client.setQueryData(keys.me, fixtures.user());
  return { calls, client };
}

async function pickNetflix() {
  await fireEvent.press(await screen.findByRole('button', { name: 'Netflix' }));
}

async function toReminders(amount = '12,99') {
  await pickNetflix();
  await fireEvent.changeText(screen.getByLabelText('Amount'), amount);
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  await screen.findByText('Remind you before it renews?');
}

const post = (calls: { method: string; path: string; body: unknown }[], path: string) =>
  calls.find((c) => c.method === 'POST' && c.path === path);

beforeEach(async () => {
  await prefs.clear();
  jest.clearAllMocks();
});

test('picking a popular tile jumps to the price step', async () => {
  const { client } = setup();
  await renderWithProviders(<NewSubscriptionScreen />, client);

  expect(await screen.findByText('Popular')).toBeTruthy();
  await pickNetflix();

  expect(await screen.findByText('How much is it?')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
});

test('searching shows matches and an own-service row', async () => {
  const { client } = setup();
  await renderWithProviders(<NewSubscriptionScreen />, client);

  await fireEvent.changeText(await screen.findByLabelText('Search services'), 'Local Gym');

  expect(await screen.findByRole('button', { name: 'Add “Local Gym” as your own service' })).toBeTruthy();
});

test('saves with the service default category, the shown date and reminders on, then offers push', async () => {
  const { calls, client } = setup();
  await renderWithProviders(<NewSubscriptionScreen />, client);

  await toReminders();
  expect(screen.getByText(/Netflix · €12\.99 monthly/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: SAVE }));

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/push-intro'));
  expect(post(calls, '/subscriptions')?.body).toEqual({
    service_id: 3,
    category_id: 2,
    amount: 1299,
    currency: 'EUR',
    period: 'month',
    interval_count: 1,
    first_payment_date: todayIso('Europe/Berlin'),
    notes: null,
    reminders_enabled: true,
  });
  expect(calls.some((c) => c.method === 'PUT')).toBe(false);
});

test('the Tomorrow chip sends tomorrow as first_payment_date', async () => {
  const { calls, client } = setup();
  await prefs.set('push.asked', '1');
  await renderWithProviders(<NewSubscriptionScreen />, client);

  await pickNetflix();
  await fireEvent.changeText(screen.getByLabelText('Amount'), '5');
  await fireEvent.press(screen.getByRole('radio', { name: 'Tomorrow' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  await fireEvent.press(await screen.findByRole('button', { name: SAVE }));

  await waitFor(() => expect(router.back).toHaveBeenCalled());
  const tomorrow = new Date(`${todayIso('Europe/Berlin')}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  expect(post(calls, '/subscriptions')?.body).toMatchObject({ first_payment_date: tomorrow.toISOString().slice(0, 10) });
});

test('the own-service path creates the service, then uploads the logo, then moves to price', async () => {
  const { calls, client } = setup({
    'POST /services': { status: 201, body: { data: fixtures.service({ id: 20, name: 'Gym Pro', color: '#0B7A57', is_custom: true, default_category_id: null }) } },
    'POST /services/20/logo': { body: { data: fixtures.service({ id: 20, name: 'Gym Pro', logo_url: 'https://cdn.test/logo.jpg', is_custom: true }) } },
  });
  await renderWithProviders(<NewSubscriptionScreen />, client);

  await fireEvent.changeText(await screen.findByLabelText('Search services'), 'Gym Pro');
  await fireEvent.press(await screen.findByRole('button', { name: 'Add “Gym Pro” as your own service' }));
  expect(await screen.findByDisplayValue('Gym Pro')).toBeTruthy();
  await fireEvent.press(screen.getByRole('radio', { name: 'Color 2' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Upload an image' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

  expect(await screen.findByText('How much is it?')).toBeTruthy();
  const own = calls.filter((c) => c.path.startsWith('/services') && c.method === 'POST');
  expect(own.map((c) => c.path)).toEqual(['/services', '/services/20/logo']);
  expect(own[0].body).toEqual({ name: 'Gym Pro', color: '#2F5BD3' });
  expect(own[1].body).toBeInstanceOf(FormData);
});

async function addOwnGymPro(image: boolean) {
  await fireEvent.changeText(await screen.findByLabelText('Search services'), 'Gym Pro');
  await fireEvent.press(await screen.findByRole('button', { name: 'Add “Gym Pro” as your own service' }));
  if (image) await fireEvent.press(await screen.findByRole('button', { name: 'Upload an image' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Continue' }));
}

test('a name that is already in the catalog continues with it, without a PATCH or logo upload', async () => {
  const { calls, client } = setup({
    'POST /services': { status: 200, body: { data: fixtures.service({ id: 4, name: 'Gym Pro', is_custom: false }) } },
  });
  await renderWithProviders(<NewSubscriptionScreen />, client);

  await addOwnGymPro(true);

  expect(await screen.findByText('How much is it?')).toBeTruthy();
  expect(screen.getByText('“Gym Pro” is already in the catalog — we\'ll use it.')).toBeTruthy();
  expect(calls.filter((c) => c.path.startsWith('/services') && c.method !== 'GET').map((c) => `${c.method} ${c.path}`)).toEqual(['POST /services']);
});

test('one of the user\'s own existing services is used as it is, without a logo upload', async () => {
  const { calls, client } = setup({
    'POST /services': { status: 200, body: { data: fixtures.service({ id: 21, name: 'Gym Pro', is_custom: true }) } },
  });
  await renderWithProviders(<NewSubscriptionScreen />, client);

  await addOwnGymPro(true);

  expect(await screen.findByText('How much is it?')).toBeTruthy();
  expect(screen.getByText('You already have “Gym Pro” — we\'ll use it as it is.')).toBeTruthy();
  expect(calls.filter((c) => c.path.startsWith('/services') && c.method !== 'GET').map((c) => `${c.method} ${c.path}`)).toEqual(['POST /services']);
});

test('creating an own service invalidates the service search cache', async () => {
  const { client } = setup({
    'POST /services': { status: 201, body: { data: fixtures.service({ id: 20, name: 'Gym Pro', is_custom: true }) } },
  });
  const spy = jest.spyOn(client, 'invalidateQueries');
  await renderWithProviders(<NewSubscriptionScreen />, client);

  await addOwnGymPro(false);
  await screen.findByText('How much is it?');
  expect(spy).toHaveBeenCalledWith({ queryKey: ['services'] });
});

test('restyling and uploading in the own-service step invalidate the service search cache', async () => {
  const { client } = setup({
    'POST /services': { status: 201, body: { data: fixtures.service({ id: 20, name: 'Gym Pro', is_custom: true }) } },
    'POST /services/20/logo': { status: 422, body: { message: 'bad', errors: { logo: ['bad'] } } },
    'PATCH /services/20': { body: { data: fixtures.service({ id: 20, name: 'Gym Max', is_custom: true }) } },
  });
  await renderWithProviders(<NewSubscriptionScreen />, client);
  await addOwnGymPro(true);
  await screen.findByText(/Couldn't upload the image/);
  const spy = jest.spyOn(client, 'invalidateQueries');

  await fireEvent.changeText(screen.getByLabelText('Name'), 'Gym Max');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

  await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: ['services'] }));
});

test('a failed logo upload keeps the service and lets the user continue', async () => {
  const { client } = setup({
    'POST /services': { status: 201, body: { data: fixtures.service({ id: 20, name: 'Gym Pro', is_custom: true }) } },
    'POST /services/20/logo': { status: 422, body: { message: 'The logo is too small.', errors: { logo: ['The logo is too small.'] } } },
  });
  await renderWithProviders(<NewSubscriptionScreen />, client);

  await fireEvent.changeText(await screen.findByLabelText('Search services'), 'Gym Pro');
  await fireEvent.press(await screen.findByRole('button', { name: 'Add “Gym Pro” as your own service' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Upload an image' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

  expect(await screen.findByText(/Couldn't upload the image/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  expect(await screen.findByText('How much is it?')).toBeTruthy();
});

test('an own service needs a name', async () => {
  const { calls, client } = setup();
  await renderWithProviders(<NewSubscriptionScreen />, client);

  await fireEvent.press(await screen.findByRole('button', { name: 'Not listed? Add your own service' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Continue' }));

  expect(await screen.findByText('Pick a service or type a name.')).toBeTruthy();
  expect(calls.some((c) => c.method === 'POST')).toBe(false);
});

test('an invalid amount stays on the price step with an inline error', async () => {
  const { calls, client } = setup();
  await renderWithProviders(<NewSubscriptionScreen />, client);

  await pickNetflix();
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

  expect(await screen.findByText('Enter a valid amount, like 12.99.')).toBeTruthy();
  expect(screen.queryByText('Remind you before it renews?')).toBeNull();
  expect(calls.some((c) => c.method === 'POST')).toBe(false);
});

test('turning reminders off sends reminders_enabled: false and no rules', async () => {
  const { calls, client } = setup();
  await prefs.set('push.asked', '1');
  await renderWithProviders(<NewSubscriptionScreen />, client);

  await toReminders();
  await fireEvent(screen.getByLabelText('Remind me'), 'valueChange', false);
  expect(screen.queryByRole('radio', { name: 'Custom' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: SAVE }));

  await waitFor(() => expect(router.back).toHaveBeenCalled());
  expect(post(calls, '/subscriptions')?.body).toMatchObject({ reminders_enabled: false });
  expect(calls.some((c) => c.method === 'PUT')).toBe(false);
});

test('custom reminders are seeded from the defaults and saved with PUT', async () => {
  const { calls, client } = setup({ 'PUT /subscriptions/11/reminders': { body: { data: [fixtures.rule()], meta: { uses_defaults: false } } } });
  await prefs.set('push.asked', '1');
  await renderWithProviders(<NewSubscriptionScreen />, client);

  await toReminders();
  await fireEvent.press(screen.getByRole('radio', { name: 'Custom' }));
  await fireEvent.press(screen.getByRole('radio', { name: '3 days' }));
  await fireEvent(screen.getByLabelText('Email'), 'valueChange', true);
  await fireEvent.press(screen.getByRole('button', { name: SAVE }));

  await waitFor(() => expect(router.back).toHaveBeenCalled());
  expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ rules: [{ days_before: 3, time_of_day: '09:00', channels: ['push', 'in_app', 'email'] }] });
});

test('shows the free-plan limit message from the server', async () => {
  const { client } = setup({ 'POST /subscriptions': { status: 403, body: { message: 'You can track up to 10 subscriptions on the free plan.' } } });
  await renderWithProviders(<NewSubscriptionScreen />, client);

  await toReminders('12.99');
  await fireEvent.press(screen.getByRole('button', { name: SAVE }));

  expect(await screen.findByText('You can track up to 10 subscriptions on the free plan.')).toBeTruthy();
  expect(router.back).not.toHaveBeenCalled();
});

test('a 422 on the service shows its message on the service step', async () => {
  const { client } = setup({
    'POST /subscriptions': { status: 422, body: { message: 'x', errors: { service_id: ['The selected service is invalid.'] } } },
  });
  await renderWithProviders(<NewSubscriptionScreen />, client);

  await toReminders('12.99');
  await fireEvent.press(screen.getByRole('button', { name: SAVE }));

  expect(await screen.findByText('The selected service is invalid.')).toBeTruthy();
  expect(screen.getByText('What are you paying for?')).toBeTruthy();
});

test('a 422 on the category shows under the category row', async () => {
  const { client } = setup({
    'POST /subscriptions': { status: 422, body: { message: 'x', errors: { category_id: ['The selected category is invalid.'] } } },
  });
  await renderWithProviders(<NewSubscriptionScreen />, client);

  await toReminders('12.99');
  await fireEvent.press(screen.getByRole('button', { name: SAVE }));

  expect(await screen.findByText('The selected category is invalid.')).toBeTruthy();
  expect(screen.getByText('How much is it?')).toBeTruthy();
});

test('retrying after a failed reminders save updates the created subscription with the new edits', async () => {
  let puts = 0;
  const { calls, client } = setup({
    'PUT /subscriptions/11/reminders': () => (++puts === 1 ? { status: 500, body: { message: 'boom' } } : { body: { data: [fixtures.rule()], meta: { uses_defaults: false } } }),
    'PATCH /subscriptions/11': { body: { data: fixtures.subscription({ id: 11 }) } },
  });
  await prefs.set('push.asked', '1');
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  await renderWithProviders(<NewSubscriptionScreen />, client);

  await toReminders('12.99');
  await fireEvent.press(screen.getByRole('radio', { name: 'Custom' }));
  await fireEvent.press(screen.getByRole('button', { name: SAVE }));
  expect(await screen.findByRole('alert', { name: 'Something went wrong. Please try again.' })).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  await fireEvent.changeText(screen.getByLabelText('Amount'), '20');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  await fireEvent.press(await screen.findByRole('button', { name: SAVE }));

  await waitFor(() => expect(router.back).toHaveBeenCalled());
  expect(calls.filter((c) => c.method === 'POST' && c.path === '/subscriptions')).toHaveLength(1);
  expect(calls.find((c) => c.method === 'PATCH')?.body).toMatchObject({ amount: 2000, reminders_enabled: true });
  expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(2);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['stats'] });
});

test('an invalid custom rule blocks the save and shows its error', async () => {
  const { calls, client } = setup();
  await renderWithProviders(<NewSubscriptionScreen />, client);

  await toReminders('12.99');
  await fireEvent.press(screen.getByRole('radio', { name: 'Custom' }));
  await fireEvent.press(screen.getByRole('button', { name: 'At' }));
  await fireEvent.changeText(screen.getByLabelText('Time (HH:MM)'), '9');
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  await fireEvent.press(screen.getByRole('button', { name: SAVE }));

  expect(await screen.findByText('Use the format HH:MM, like 09:00.')).toBeTruthy();
  expect(calls.some((c) => c.method === 'POST')).toBe(false);
});

test('renaming after a failed logo upload updates the created service instead of creating another', async () => {
  const { calls, client } = setup({
    'POST /services': { status: 201, body: { data: fixtures.service({ id: 20, name: 'Gym Pro', is_custom: true }) } },
    'POST /services/20/logo': { status: 422, body: { message: 'bad', errors: { logo: ['bad'] } } },
    'PATCH /services/20': { body: { data: fixtures.service({ id: 20, name: 'Gym Max', is_custom: true }) } },
  });
  await renderWithProviders(<NewSubscriptionScreen />, client);

  await fireEvent.changeText(await screen.findByLabelText('Search services'), 'Gym Pro');
  await fireEvent.press(await screen.findByRole('button', { name: 'Add “Gym Pro” as your own service' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Upload an image' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  await screen.findByText(/Couldn't upload the image/);

  await fireEvent.changeText(screen.getByLabelText('Name'), 'Gym Max');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

  expect(await screen.findByText('How much is it?')).toBeTruthy();
  expect(calls.filter((c) => c.method === 'POST' && c.path === '/services')).toHaveLength(1);
  expect(calls.find((c) => c.method === 'PATCH')?.body).toMatchObject({ name: 'Gym Max' });
});

test('a failed profile load offers a retry instead of spinning forever', async () => {
  useSession.setState({ token: 'tok', status: 'signedIn' });
  mockApi({ 'GET /me': { status: 500, body: { message: 'x' } }, 'GET /categories': { body: { data: [] } } });
  await renderWithProviders(<NewSubscriptionScreen />);

  expect(await screen.findByRole('button', { name: 'Try again' })).toBeTruthy();
  useSession.setState({ token: null, status: 'loading' });
});
