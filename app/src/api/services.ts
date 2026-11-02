import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';

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

export type NewService = { name: string; color?: string; default_category_id?: number };

const LOGO_FILE = { name: 'logo.jpg', type: 'image/jpeg' };

export const servicesApi = {
  /** Returns the visible service with the same name, or creates the user's own. */
  create: (body: NewService) => api<Data<Service>>('/services', { method: 'POST', body }).then((r) => r.data),

  update: (id: number, body: { name?: string; color?: string }) =>
    api<Data<Service>>(`/services/${id}`, { method: 'PATCH', body }).then((r) => r.data),

  /** Uploads the picked image (a local uri) as the service's logo. */
  uploadLogo: async (id: number, uri: string) => {
    const form = new FormData();
    if (Platform.OS === 'web') {
      // Browsers need a real Blob; React Native takes the { uri, name, type } descriptor.
      form.append('logo', await (await fetch(uri)).blob(), LOGO_FILE.name);
    } else {
      form.append('logo', { uri, ...LOGO_FILE } as unknown as Blob);
    }
    return api<Data<Service>>(`/services/${id}/logo`, { method: 'POST', body: form }).then((r) => r.data);
  },
};

export function useCreateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: servicesApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  });
}
