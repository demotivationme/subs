import type { SubscriptionFilter } from './subscriptions';

export const keys = {
  me: ['me'] as const,
  dashboard: ['dashboard'] as const,
  categories: ['categories'] as const,
  services: (q: string) => ['services', q] as const,
  subscriptionsAll: ['subscriptions'] as const,
  subscriptions: (filter: SubscriptionFilter) => ['subscriptions', filter] as const,
  subscription: (id: number) => ['subscription', id] as const,
  subscriptionRules: (id: number) => ['subscription', id, 'reminders'] as const,
  reminderDefaults: ['reminder-defaults'] as const,
  notifications: ['notifications'] as const,
  inbox: ['notifications', 'inbox'] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
};
