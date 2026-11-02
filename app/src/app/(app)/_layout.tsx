import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useMe } from '@/api/me';
import i18n, { supportedLocale } from '@/i18n';

export default function AppLayout() {
  const { t } = useTranslation();
  const locale = useMe().data?.locale;

  // The account's language wins over the device's once we know it.
  useEffect(() => {
    if (locale) void i18n.changeLanguage(supportedLocale(locale));
  }, [locale]);

  return (
    <Stack screenOptions={{ headerBackTitle: t('common.back') }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
