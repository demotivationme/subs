import { API_URL } from './config';
import { ApiError, NetworkError } from './errors';

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
type Query = Record<string, string | number | null | undefined>;

type Hooks = {
  getToken: () => string | null;
  onUnauthorized: (sentToken: string) => void;
  getLocale: () => string;
};

let hooks: Hooks = { getToken: () => null, onUnauthorized: () => {}, getLocale: () => 'en' };

/** Wired once by the session module, which owns the token. */
export function configureApi(next: Hooks): void {
  hooks = next;
}

function queryString(query?: Query): string {
  const pairs = Object.entries(query ?? {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return pairs.length ? `?${pairs.join('&')}` : '';
}

export async function api<T>(path: string, options: { method?: Method; body?: unknown; query?: Query } = {}): Promise<T> {
  const { method = 'GET', body, query } = options;
  const token = hooks.getToken();
  const multipart = typeof FormData !== 'undefined' && body instanceof FormData;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}${queryString(query)}`, {
      method,
      headers: {
        Accept: 'application/json',
        'Accept-Language': hooks.getLocale(),
        ...(body !== undefined && !multipart ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      // A FormData body goes as-is: fetch sets the multipart Content-Type with its boundary.
      body: multipart ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    throw new NetworkError(error);
  }

  if (response.status === 204) return undefined as T;

  const data = (await response.json().catch(() => null)) as { message?: string; errors?: Record<string, string[]> } | null;

  if (!response.ok) {
    // Only a request that carried a token can mean "your session ended".
    if (response.status === 401 && token) hooks.onUnauthorized(token);
    throw new ApiError(response.status, data?.message ?? response.statusText, data?.errors ?? {});
  }

  return data as T;
}
