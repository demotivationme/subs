import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, useColorScheme, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useCategories } from '@/api/categories';
import { useSubscriptions, type SubscriptionFilter } from '@/api/subscriptions';
import type { SubscriptionStatus } from '@/api/types';
import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Loading } from '@/components/Loading';
import { Screen } from '@/components/Screen';
import { SegmentedChoice } from '@/components/SegmentedChoice';
import { SelectField } from '@/components/SelectField';
import { SubscriptionRow } from '@/components/SubscriptionRow';

type Sort = NonNullable<SubscriptionFilter['sort']>;
type StatusFilter = 'all' | SubscriptionStatus;
const ALL = 'all';
const ANY_CATEGORY = 0;

function FilterButton({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  // Chevron color mirrors the muted token.
  const color = useColorScheme() === 'dark' ? '#9AA3AF' : '#5B6370';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityValue={{ text: value }}
      onPress={onPress}
      className="h-10 flex-1 flex-row items-center justify-between rounded-xl border border-line bg-surface px-3 dark:border-line-dark dark:bg-surface-dark">
      <AppText className="font-medium text-sm" numberOfLines={1}>{value}</AppText>
      <Ionicons name="chevron-down" size={16} color={color} />
    </Pressable>
  );
}

export default function SubscriptionsScreen() {
  const { t } = useTranslation();
  const [sort, setSort] = useState<Sort>('next_payment');
  const [status, setStatus] = useState<StatusFilter>(ALL);
  const [categoryId, setCategoryId] = useState<number>(ANY_CATEGORY);
  const [statusOpen, setStatusOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);

  const filter: SubscriptionFilter = {
    sort,
    ...(status !== ALL ? { status } : {}),
    ...(categoryId !== ANY_CATEGORY ? { category_id: categoryId } : {}),
  };
  const list = useSubscriptions(filter);
  const categories = useCategories();

  const sortOptions: { value: Sort; label: string }[] = [
    { value: 'next_payment', label: t('subscriptions.sortNext') },
    { value: 'price', label: t('subscriptions.sortPrice') },
    { value: 'name', label: t('subscriptions.sortName') },
  ];
  const statusOptions = [
    { value: ALL, label: t('subscriptions.allStatuses') },
    { value: 'active', label: t('status.active') },
    { value: 'paused', label: t('status.paused') },
    { value: 'cancelled', label: t('status.cancelled') },
  ] as const;
  const categoryOptions = [
    { value: ANY_CATEGORY, label: t('subscriptions.allCategories') },
    ...(categories.data ?? []).map((c) => ({ value: c.id, label: c.label })),
  ];

  const header = (
    <View className="gap-2.5 pb-3">
      <SegmentedChoice
        value={sort}
        onChange={setSort}
        options={sortOptions}
      />
      <View className="flex-row gap-2">
        <FilterButton
          label={t('subscriptions.status')}
          value={statusOptions.find((o) => o.value === status)?.label ?? ''}
          onPress={() => setStatusOpen(true)}
        />
        <FilterButton
          label={t('subscriptions.category')}
          value={categoryOptions.find((o) => o.value === categoryId)?.label ?? ''}
          onPress={() => setCategoryOpen(true)}
        />
      </View>
      <SelectField hideTrigger label={t('subscriptions.status')} value={status} onChange={setStatus} options={statusOptions} open={statusOpen} onOpenChange={setStatusOpen} />
      <SelectField hideTrigger label={t('subscriptions.category')} value={categoryId} onChange={setCategoryId} options={categoryOptions} open={categoryOpen} onOpenChange={setCategoryOpen} />
      <ErrorMessage error={list.error} />
    </View>
  );

  return (
    <Screen scroll={false}>
      <FlatList
        data={list.data ?? []}
        keyExtractor={(s) => String(s.id)}
        ListHeaderComponent={header}
        ListEmptyComponent={list.isPending ? <Loading /> : <EmptyState message={t('subscriptions.empty')} />}
        ItemSeparatorComponent={() => <View className="h-2" />}
        renderItem={({ item }) => <SubscriptionRow subscription={item} onPress={() => router.push(`/subscriptions/${item.id}`)} />}
        refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} />}
        keyboardShouldPersistTaps="handled"
      />
    </Screen>
  );
}
