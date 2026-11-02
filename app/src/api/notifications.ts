import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './client';
import { keys } from './keys';
import type { AppNotification, Paginated } from './types';

export function useInbox() {
  return useInfiniteQuery({
    queryKey: keys.inbox,
    queryFn: ({ pageParam }) => api<Paginated<AppNotification>>('/notifications', { query: { page: pageParam } }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.current_page < last.meta.last_page ? last.meta.current_page + 1 : undefined),
    staleTime: 0,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: keys.unreadCount,
    queryFn: () => api<{ count: number }>('/notifications/unread-count').then((r) => r.count),
    staleTime: 0,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.notifications }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('/notifications/read-all', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.notifications }),
  });
}
