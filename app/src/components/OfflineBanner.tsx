import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useOnline } from '@/api/useOnline';

export function OfflineBanner() {
  const { t } = useTranslation();
  if (useOnline()) return null;
  return (
    <View accessibilityRole="alert" className="rounded-xl bg-warn-soft px-4 py-2 dark:bg-warn-soft-dark">
      <Text className="text-center font-medium text-warn-ink dark:text-warn-ink-dark">{t('offline')}</Text>
    </View>
  );
}
