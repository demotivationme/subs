import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './client';
import { keys } from './keys';
import type { Data, ReminderRule, ReminderRuleInput } from './types';

type RulesResponse = { data: ReminderRule[]; meta?: { uses_defaults: boolean } };
export type SubscriptionRules = { rules: ReminderRule[]; usesDefaults: boolean };

function toSubscriptionRules(response: RulesResponse): SubscriptionRules {
  return { rules: response.data, usesDefaults: response.meta?.uses_defaults ?? response.data.length === 0 };
}

export const remindersApi = {
  /** An empty list reverts the subscription to the user's defaults. */
  replaceForSubscription: (id: number, rules: ReminderRuleInput[]) =>
    api<RulesResponse>(`/subscriptions/${id}/reminders`, { method: 'PUT', body: { rules } }).then(toSubscriptionRules),
};

export function useReminderDefaults() {
  return useQuery({
    queryKey: keys.reminderDefaults,
    queryFn: () => api<Data<ReminderRule[]>>('/reminder-defaults').then((r) => r.data),
  });
}

export function useUpdateReminderDefaults() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rules: ReminderRuleInput[]) =>
      api<Data<ReminderRule[]>>('/reminder-defaults', { method: 'PUT', body: { rules } }).then((r) => r.data),
    onSuccess: (rules) => qc.setQueryData(keys.reminderDefaults, rules),
  });
}

export function useSubscriptionRules(id: number) {
  return useQuery({
    queryKey: keys.subscriptionRules(id),
    queryFn: () => api<RulesResponse>(`/subscriptions/${id}/reminders`).then(toSubscriptionRules),
  });
}

export function useUpdateSubscriptionRules(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rules: ReminderRuleInput[]) => remindersApi.replaceForSubscription(id, rules),
    onSuccess: (result) => qc.setQueryData(keys.subscriptionRules(id), result),
  });
}
