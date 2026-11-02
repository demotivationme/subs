import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './client';
import { keys } from './keys';
import type { Data, Period, Subscription, SubscriptionStatus } from './types';

export type SubscriptionFilter = {
  status?: SubscriptionStatus;
  category_id?: number;
  sort?: 'price' | 'next_payment' | 'name';
};

export type SubscriptionPayload = {
  service_id?: number;
  service_name?: string;
  category_id?: number;
  amount: number;
  currency: string;
  period: Period;
  interval_count: number;
  first_payment_date: string;
  notes: string | null;
  status?: SubscriptionStatus;
};

function useInvalidateSpend() {
  const qc = useQueryClient();
  return (id?: number) =>
    Promise.all([
      qc.invalidateQueries({ queryKey: keys.subscriptionsAll }),
      qc.invalidateQueries({ queryKey: keys.dashboard }),
      ...(id !== undefined ? [qc.invalidateQueries({ queryKey: keys.subscription(id) })] : []),
    ]);
}

export function useSubscriptions(filter: SubscriptionFilter) {
  return useQuery({
    queryKey: keys.subscriptions(filter),
    queryFn: () => api<Data<Subscription[]>>('/subscriptions', { query: filter }).then((r) => r.data),
  });
}

export function useSubscription(id: number) {
  return useQuery({
    queryKey: keys.subscription(id),
    queryFn: () => api<Data<Subscription>>(`/subscriptions/${id}`).then((r) => r.data),
  });
}

export function useCreateSubscription() {
  const invalidate = useInvalidateSpend();
  return useMutation({
    mutationFn: (body: SubscriptionPayload) =>
      api<Data<Subscription>>('/subscriptions', { method: 'POST', body }).then((r) => r.data),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateSubscription(id: number) {
  const qc = useQueryClient();
  const invalidate = useInvalidateSpend();
  return useMutation({
    mutationFn: (body: Partial<SubscriptionPayload>) =>
      api<Data<Subscription>>(`/subscriptions/${id}`, { method: 'PATCH', body }).then((r) => r.data),
    onSuccess: (subscription) => {
      qc.setQueryData(keys.subscription(id), subscription);
      return invalidate();
    },
  });
}

export function useDeleteSubscription(id: number) {
  const qc = useQueryClient();
  const invalidate = useInvalidateSpend();
  return useMutation({
    mutationFn: () => api<void>(`/subscriptions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.removeQueries({ queryKey: keys.subscription(id) });
      return invalidate();
    },
  });
}
