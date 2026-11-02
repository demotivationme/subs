import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import '@/i18n';
import { API_URL } from '@/api/config';

export type MockResponse = { status?: number; body?: unknown };
export type MockRoute = MockResponse | ((request: { path: string; body: unknown }) => MockResponse);
export type RecordedCall = { method: string; path: string; body: unknown };

/**
 * Replaces fetch. Routes are keyed "METHOD /path" (exact, with query) or "METHOD /path"
 * without the query string; an unmocked request rejects, which the client reports as a NetworkError.
 */
export function mockApi(routes: Record<string, MockRoute>): RecordedCall[] {
  const calls: RecordedCall[] = [];
  global.fetch = jest.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    const path = String(input).replace(API_URL, '');
    // JSON bodies are recorded parsed; a multipart FormData is recorded as the FormData itself.
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body instanceof FormData ? init.body : undefined;
    calls.push({ method, path, body });
    const route = routes[`${method} ${path}`] ?? routes[`${method} ${path.split('?')[0]}`];
    if (route === undefined) throw new Error(`Unmocked request: ${method} ${path}`);
    const { status = 200, body: responseBody = null } = typeof route === 'function' ? route({ path, body }) : route;
    return { ok: status >= 200 && status < 300, status, statusText: String(status), json: async () => responseBody } as Response;
  }) as typeof fetch;
  return calls;
}

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, networkMode: 'always', gcTime: Infinity },
    },
  });
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

export async function renderWithProviders(ui: ReactElement, client: QueryClient = createTestQueryClient()) {
  const result = await render(ui, { wrapper: wrapperFor(client) });
  return { ...result, client };
}

export function renderHookWithProviders<T>(hook: () => T, client: QueryClient = createTestQueryClient()) {
  return renderHook(hook, { wrapper: wrapperFor(client) });
}
