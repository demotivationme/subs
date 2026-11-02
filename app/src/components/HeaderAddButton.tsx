import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

const NEW_SUBSCRIPTION = '/subscriptions/new';

/** Accent "+" tile for the Subscriptions header. */
export function HeaderAddButton() {
  const { t } = useTranslation();
  // The icon sits on the accent tile, so it is white in both schemes.
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('subscriptions.add')}
      onPress={() => router.push(NEW_SUBSCRIPTION)}
      className="h-11 w-11 items-center justify-center rounded-[14px] bg-accent dark:bg-accent-dark">
      <Ionicons name="add" size={26} color="#FFFFFF" />
    </Pressable>
  );
}
