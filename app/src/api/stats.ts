import { useQuery } from '@tanstack/react-query';

import { api } from './client';
import { keys } from './keys';
import type { Stats } from './types';

export function useStats(year: number, month?: number) {
  return useQuery({
    queryKey: keys.stats(year, month),
    queryFn: () => api<Stats>('/stats', { query: { year, month } }),
    placeholderData: (previous) => previous,
  });
}
