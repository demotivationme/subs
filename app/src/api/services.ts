import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { api } from './client';
import { keys } from './keys';
import type { Data, Service } from './types';

/** Catalog plus the user's own services, filtered by name. */
export function useServiceSearch(q: string) {
  return useQuery({
    queryKey: keys.services(q),
    queryFn: () => api<Data<Service[]>>('/services', { query: { q } }).then((r) => r.data),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
}
