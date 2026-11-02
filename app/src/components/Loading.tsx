import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';

export function Loading() {
  const { t } = useTranslation();
  return (
    <View className="flex-1 items-center justify-center bg-ground py-8 dark:bg-ground-dark">
      <ActivityIndicator accessibilityLabel={t('common.loading')} />
    </View>
  );
}
