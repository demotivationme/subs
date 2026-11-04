import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './client';
import { keys } from './keys';
import { logoPart } from './logoPart';
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

export const servicesApi = {
  /** Returns the visible service with the same name (existing: true), or creates the user's own. */
  create: async (body: NewService): Promise<{ service: Service; existing: boolean }> => {
    let status = 201;
    const response = await api<Data<Service>>('/services', { method: 'POST', body, onStatus: (s) => (status = s) });
    return { service: response.data, existing: status !== 201 };
  },

  update: (id: number, body: { name?: string; color?: string }) =>
    api<Data<Service>>(`/services/${id}`, { method: 'PATCH', body }).then((r) => r.data),

  /** Uploads the picked image (a local uri) as the service's logo. */
  uploadLogo: async (id: number, uri: string) => {
    const form = new FormData();
    form.append('logo', ...(await logoPart(uri)));
    return api<Data<Service>>(`/services/${id}/logo`, { method: 'POST', body: form }).then((r) => r.data);
  },
};

function useInvalidateServices() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['services'] });
}

export function useCreateService() {
  const invalidate = useInvalidateServices();
  return useMutation({ mutationFn: servicesApi.create, onSuccess: invalidate });
}

export function useUpdateService() {
  const invalidate = useInvalidateServices();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number; name?: string; color?: string }) => servicesApi.update(id, body),
    onSuccess: invalidate,
  });
}

export function useUploadServiceLogo() {
  const invalidate = useInvalidateServices();
  return useMutation({
    mutationFn: ({ id, uri }: { id: number; uri: string }) => servicesApi.uploadLogo(id, uri),
    onSuccess: invalidate,
  });
}
