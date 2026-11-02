import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

/** Tapping a payment reminder opens its subscription (also on a cold start). */
export function useNotificationTaps(): void {
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = (response.notification.request.content.data as { subscription_id?: unknown } | undefined)?.subscription_id;
    if (typeof id === 'number' || typeof id === 'string') router.push(`/subscriptions/${id}`);
  }, [response]);
}
