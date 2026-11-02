import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import type { PersistQueryClientProviderProps } from '@tanstack/react-query-persist-client';

import { ApiError } from './errors';

const DAY = 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: DAY,
      // 4xx answers won't change on retry; network and 5xx errors get two more tries.
      retry: (failureCount, error) => !(error instanceof ApiError && error.status < 500) && failureCount < 2,
    },
    // Offline, mutations fail at once (NetworkError) instead of pausing: the UI is read-only.
    mutations: { networkMode: 'always', retry: false },
  },
});

export const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'subs.query-cache' });

/** Cached data survives restarts, so the app shows the last known state offline. */
export const persistOptions: PersistQueryClientProviderProps['persistOptions'] = {
  persister,
  maxAge: DAY,
  buster: 'v1',
};

export async function clearQueryCache(): Promise<void> {
  queryClient.clear();
  await persister.removeClient();
}
