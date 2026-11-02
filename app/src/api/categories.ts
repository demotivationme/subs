import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './client';
import { keys } from './keys';
import type { Category, Data } from './types';

export type CategoryPayload = { name: string; icon?: string; color?: string };

export function useCategories() {
  return useQuery({
    queryKey: keys.categories,
    queryFn: () => api<Data<Category[]>>('/categories').then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CategoryPayload) => api<Data<Category>>('/categories', { method: 'POST', body }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.categories }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<CategoryPayload> & { id: number }) =>
      api<Data<Category>>(`/categories/${id}`, { method: 'PATCH', body }).then((r) => r.data),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: keys.categories }),
        qc.invalidateQueries({ queryKey: keys.subscriptionsAll }),
        qc.invalidateQueries({ queryKey: keys.dashboard }),
        qc.invalidateQueries({ queryKey: keys.statsAll }),
      ]),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/categories/${id}`, { method: 'DELETE' }),
    // Its subscriptions moved to "Other".
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: keys.categories }),
        qc.invalidateQueries({ queryKey: keys.subscriptionsAll }),
        qc.invalidateQueries({ queryKey: ['subscription'] }),
        qc.invalidateQueries({ queryKey: keys.dashboard }),
        qc.invalidateQueries({ queryKey: keys.statsAll }),
      ]),
  });
}
