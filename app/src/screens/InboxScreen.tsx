import { useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { keys } from '@/api/keys';
import { useInbox, useMarkAllRead, useMarkRead } from '@/api/notifications';
import type { AppNotification } from '@/api/types';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Loading } from '@/components/Loading';
import { Screen } from '@/components/Screen';
import { useLocale } from '@/i18n/useLocale';
import { formatDateTime } from '@/lib/dates';

function InboxRow({ item, onPress }: { item: AppNotification; onPress: () => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const unread = item.read_at === null;
  const time = formatDateTime(item.created_at, locale);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${item.title}. ${item.body}. ${time}`} onPress={onPress}>
      <View
        testID={unread ? 'inbox-row-unread' : 'inbox-row-read'}
        className={
          unread
            ? 'flex-row gap-3 rounded-card border border-transparent bg-surface p-3.5 dark:bg-surface-dark'
            : 'flex-row gap-3 rounded-card border border-line bg-transparent p-3.5 dark:border-line-dark'
        }>
        <View className="w-2 pt-2">
          {unread ? <View accessible accessibilityLabel={t('inbox.unread')} className="h-2 w-2 rounded-full bg-accent dark:bg-accent-dark" /> : null}
        </View>
        <View className="flex-1 gap-1">
          <AppText className={unread ? 'font-bold' : 'font-medium'}>{item.title}</AppText>
          <AppText numeric variant={unread ? 'body' : 'muted'}>{item.body}</AppText>
          <AppText numeric variant="muted" className="text-xs">{time}</AppText>
        </View>
      </View>
    </Pressable>
  );
}

export default function InboxScreen() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const inbox = useInbox();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();

  // The stack keeps this screen mounted underneath others, so refresh whenever it regains focus.
  useFocusEffect(
    useCallback(() => {
      void qc.invalidateQueries({ queryKey: keys.notifications });
    }, [qc]),
  );

  const items = inbox.data?.pages.flatMap((page) => page.data) ?? [];
  const hasUnread = items.some((n) => n.read_at === null);

  const open = (item: AppNotification) => {
    if (item.read_at === null) markRead.mutate(item.id);
    if (item.subscription_id !== null) router.push(`/subscriptions/${item.subscription_id}`);
  };

  return (
    <Screen scroll={false}>
      <FlatList
        testID="inbox-list"
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerClassName="gap-2 pb-8"
        renderItem={({ item }) => <InboxRow item={item} onPress={() => open(item)} />}
        ListHeaderComponent={
          <View className="items-end">
            {hasUnread ? (
              <Button className="h-9 px-1" label={t('inbox.markAllRead')} variant="ghost" loading={markAll.isPending} onPress={() => markAll.mutate()} />
            ) : null}
            <ErrorMessage error={inbox.error ?? markRead.error ?? markAll.error} />
          </View>
        }
        ListEmptyComponent={inbox.isPending ? <Loading /> : <EmptyState message={t('inbox.empty')} />}
        ListFooterComponent={inbox.isFetchingNextPage ? <Loading /> : undefined}
        onEndReached={() => {
          if (inbox.hasNextPage && !inbox.isFetchingNextPage) void inbox.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={inbox.isRefetching && !inbox.isFetchingNextPage} onRefresh={() => void inbox.refetch()} />}
      />
    </Screen>
  );
}
