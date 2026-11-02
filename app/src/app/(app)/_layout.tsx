import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useMe } from '@/api/me';
import i18n, { supportedLocale } from '@/i18n';
import { enablePush, isPushEnabled } from '@/push';
import { useNotificationTaps } from '@/push/useNotificationTaps';

const MODAL = 'modal';
// The add flow draws its own header (progress, Back, Close).
const NEW_SUBSCRIPTION_OPTIONS = { presentation: MODAL, headerShown: false } as const;

export default function AppLayout() {
  const { t } = useTranslation();
  const locale = useMe().data?.locale;

  // The account's language wins over the device's once we know it.
  useEffect(() => {
    if (locale) void i18n.changeLanguage(supportedLocale(locale));
  }, [locale]);

  useNotificationTaps();

  // Re-register on every start so a rotated token reaches the API.
  useEffect(() => {
    void isPushEnabled().then((on) => (on ? enablePush() : undefined));
  }, []);

  return (
    <Stack screenOptions={{ headerBackTitle: t('common.back') }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="subscriptions/new" options={NEW_SUBSCRIPTION_OPTIONS} />
      <Stack.Screen name="subscriptions/[id]" options={{ title: t('subscription.title') }} />
      <Stack.Screen name="notifications" options={{ title: t('tabs.notifications') }} />
      <Stack.Screen name="categories" options={{ title: t('categories.title') }} />
      <Stack.Screen name="settings/reminders" options={{ title: t('settings.defaultReminders') }} />
      <Stack.Screen name="push-intro" options={{ title: t('push.introTitle'), presentation: MODAL }} />
    </Stack>
  );
}
