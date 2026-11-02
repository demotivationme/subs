import { useQuery } from '@tanstack/react-query';

import { api } from './client';
import { keys } from './keys';
import type { Dashboard } from './types';

export function useDashboard() {
  return useQuery({ queryKey: keys.dashboard, queryFn: () => api<Dashboard>('/dashboard') });
}
