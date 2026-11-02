import { renderHook } from '@testing-library/react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';

import { useNotificationTaps } from './useNotificationTaps';

test('tapping a reminder opens its subscription', async () => {
  jest.mocked(Notifications.useLastNotificationResponse).mockReturnValue({
    actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
    notification: { request: { content: { data: { subscription_id: 7 } } } },
  } as never);

  await renderHook(() => useNotificationTaps());

  expect(router.push).toHaveBeenCalledWith('/subscriptions/7');
});

test('ignores responses without a subscription', async () => {
  jest.mocked(Notifications.useLastNotificationResponse).mockReturnValue({
    actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
    notification: { request: { content: { data: {} } } },
  } as never);

  await renderHook(() => useNotificationTaps());

  expect(router.push).not.toHaveBeenCalled();
});

test('a response already handled is not replayed on remount', async () => {
  jest.mocked(Notifications.useLastNotificationResponse).mockReturnValue({
    actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
    notification: { request: { identifier: 'once', content: { data: { subscription_id: 9 } } } },
  } as never);

  await renderHook(() => useNotificationTaps());
  await renderHook(() => useNotificationTaps());

  expect(router.push).toHaveBeenCalledTimes(1);
});
