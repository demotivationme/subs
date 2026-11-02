import { api, configureApi } from './client';
import { API_URL } from './config';
import { ApiError, NetworkError } from './errors';

const onUnauthorized = jest.fn();
let token: string | null = 'tok';

function respond(status: number, body: unknown = null) {
  global.fetch = jest.fn(async () => ({ ok: status < 300, status, statusText: 'x', json: async () => body }) as Response);
}

beforeEach(() => {
  token = 'tok';
  configureApi({ getToken: () => token, onUnauthorized, getLocale: () => 'en' });
});

test('sends JSON with the bearer token, locale and a query string without empty values', async () => {
  respond(200, { ok: true });

  await api('/subscriptions', { method: 'POST', body: { a: 1 }, query: { sort: 'price', status: undefined, page: 2 } });

  expect(global.fetch).toHaveBeenCalledWith(`${API_URL}/subscriptions?sort=price&page=2`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en',
      'Content-Type': 'application/json',
      Authorization: 'Bearer tok',
    },
    body: '{"a":1}',
  });
});

test('returns undefined for 204', async () => {
  respond(204);
  await expect(api('/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
});

test('turns a 422 into an ApiError carrying field errors', async () => {
  respond(422, { message: 'The email has already been taken.', errors: { email: ['The email has already been taken.'] } });

  const error = await api<ApiError>('/auth/register', { method: 'POST', body: {} }).catch((e: unknown) => e as ApiError);

  expect(error).toBeInstanceOf(ApiError);
  expect(error.status).toBe(422);
  expect(error.errors.email).toEqual(['The email has already been taken.']);
  expect(onUnauthorized).not.toHaveBeenCalled();
});

test('a 401 on an authenticated request signs out', async () => {
  respond(401, { message: 'Unauthenticated.' });
  await expect(api('/me')).rejects.toBeInstanceOf(ApiError);
  expect(onUnauthorized).toHaveBeenCalledTimes(1);
});

test('a 401 without a token (e.g. a stale login form) does not', async () => {
  token = null;
  respond(401, { message: 'Unauthenticated.' });
  await expect(api('/me')).rejects.toBeInstanceOf(ApiError);
  expect(onUnauthorized).not.toHaveBeenCalled();
});

test('a failed fetch becomes a NetworkError', async () => {
  global.fetch = jest.fn(async () => {
    throw new TypeError('Network request failed');
  });
  await expect(api('/dashboard')).rejects.toBeInstanceOf(NetworkError);
});

test('a non-JSON error body still yields an ApiError', async () => {
  global.fetch = jest.fn(async () => ({ ok: false, status: 502, statusText: 'Bad Gateway', json: async () => { throw new SyntaxError('x'); } }) as unknown as Response);
  const error = await api<ApiError>('/dashboard').catch((e: unknown) => e as ApiError);
  expect(error).toBeInstanceOf(ApiError);
  expect(error.status).toBe(502);
});
