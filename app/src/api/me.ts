import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/auth/session';

import { api } from './client';
import { keys } from './keys';
import type { Data, User } from './types';

export type ProfilePatch = Partial<Pick<User, 'name' | 'timezone' | 'currency' | 'locale'>>;

export function useMe() {
  const token = useSession((s) => s.token);
  return useQuery({
    queryKey: keys.me,
    queryFn: () => api<Data<User>>('/me').then((r) => r.data),
    enabled: token !== null,
  });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: ProfilePatch) => api<Data<User>>('/me', { method: 'PATCH', body: patch }).then((r) => r.data),
    onSuccess: (user) => {
      qc.setQueryData(keys.me, user);
      // Totals and monthly equivalents are in the main currency.
      return Promise.all([
        qc.invalidateQueries({ queryKey: keys.dashboard }),
        qc.invalidateQueries({ queryKey: keys.statsAll }),
        qc.invalidateQueries({ queryKey: keys.subscriptionsAll }),
      ]);
    },
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: (password: string) => api<void>('/me', { method: 'DELETE', body: { password } }),
    onSuccess: () => useSession.getState().signOut(),
  });
}
