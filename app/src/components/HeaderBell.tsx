import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, useColorScheme, View } from 'react-native';

import { useUnreadCount } from '@/api/notifications';

import { AppText } from './AppText';

const INBOX = '/notifications';

export function HeaderBell() {
  const { t } = useTranslation();
  const { data: count = 0 } = useUnreadCount();
  // Icon color mirrors the ink token.
  const color = useColorScheme() === 'dark' ? '#F1F3F5' : '#14171C';

  const openInbox = () => router.push(INBOX);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('inbox.bell', { count })}
      onPress={openInbox}
      className="h-11 w-11 items-center justify-center rounded-[14px] bg-surface dark:bg-surface-dark">
      <Ionicons name="notifications-outline" size={22} color={color} />
      {count > 0 ? (
        <View className="absolute right-1.5 top-1.5 h-[18px] min-w-[18px] items-center justify-center rounded-full bg-badge px-1">
          <AppText numeric className="font-bold text-[11px] text-white dark:text-white">{count > 99 ? '99+' : String(count)}</AppText>
        </View>
      ) : null}
    </Pressable>
  );
}
