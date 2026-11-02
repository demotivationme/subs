import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ApiError } from '@/api/errors';
import { useMe } from '@/api/me';
import { useDeleteSubscription, useSubscription, useUpdateSubscription } from '@/api/subscriptions';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Loading } from '@/components/Loading';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Screen } from '@/components/Screen';
import { ServiceIcon } from '@/components/ServiceIcon';
import { useLocale } from '@/i18n/useLocale';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { periodLabel, yearlyAmount } from '@/lib/period';

import { EditSubscription } from './subscription/EditSubscription';
import { SubscriptionReminders } from './subscription/SubscriptionReminders';

const PAUSED = { status: 'paused' } as const;
const ACTIVE = { status: 'active' } as const;
const CANCELLED = { status: 'cancelled' } as const;

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 gap-0.5">
      <AppText variant="muted" className="text-xs">{label}</AppText>
      <AppText numeric className="font-semibold">{value}</AppText>
    </View>
  );
}

export default function SubscriptionDetailScreen() {
  const { t } = useTranslation();
  const locale = useLocale();
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const subscription = useSubscription(id);
  const me = useMe();
  const update = useUpdateSubscription(id);
  const remove = useDeleteSubscription(id);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (subscription.isError) {
    const gone = subscription.error instanceof ApiError && subscription.error.status === 404;
    return (
      <Screen>
        {gone ? <AppText>{t('subscription.notFound')}</AppText> : <ErrorMessage error={subscription.error} />}
      </Screen>
    );
  }
  if (!subscription.data) return <Loading />;

  const s = subscription.data;

  if (editing) {
    return (
      <View className="flex-1 bg-ground dark:bg-ground-dark">
        <OfflineBanner />
        <EditSubscription subscription={s} onDone={() => setEditing(false)} />
      </View>
    );
  }

  const money = (minor: number) => formatMoney(minor, s.currency, locale);
  // Only when it adds information: another currency, or a period that isn't a plain month.
  const showMonthly =
    s.monthly_equivalent !== null && me.data !== undefined && (s.currency !== me.data.currency || s.period !== 'month' || s.interval_count !== 1);

  return (
    <View className="flex-1 bg-ground dark:bg-ground-dark">
      <ScrollView contentContainerClassName="gap-4 p-4 pb-12" keyboardShouldPersistTaps="handled">
        <OfflineBanner />

        <View className="flex-row items-center gap-3.5">
          <ServiceIcon service={s.service} size={56} />
          <View className="flex-1 gap-0.5">
            <AppText variant="title" className="text-[26px]">{s.service.name}</AppText>
            <AppText variant="muted">{t('subscription.headerMeta', { category: s.category.label, status: t(`status.${s.status}`) })}</AppText>
          </View>
        </View>

        <Card className="gap-1 rounded-[20px] p-[18px]">
          <View className="flex-row items-baseline gap-2">
            <AppText numeric className="font-display text-4xl">{money(s.amount)}</AppText>
            <AppText variant="muted" className="text-[15px]">{periodLabel(t, s.period, s.interval_count)}</AppText>
          </View>
          <AppText variant="muted" numeric>{t('subscription.perYear', { amount: money(yearlyAmount(s.amount, s.period, s.interval_count)) })}</AppText>
          {showMonthly && me.data ? (
            <AppText variant="muted" numeric>{t('subscription.monthlyLine', { amount: formatMoney(s.monthly_equivalent as number, me.data.currency, locale) })}</AppText>
          ) : null}
          <View className="mt-3 flex-row gap-3">
            <Fact label={t('subscription.nextPayment')} value={formatDate(s.next_payment_date, locale)} />
            <Fact label={t('subscription.firstPayment')} value={formatDate(s.first_payment_date, locale)} />
          </View>
        </Card>

        {s.notes ? (
          <Card className="gap-1.5 rounded-[20px] px-[18px] py-4">
            <AppText variant="muted" className="text-xs">{t('subscription.notes')}</AppText>
            <AppText>{s.notes}</AppText>
          </Card>
        ) : null}

        <SubscriptionReminders subscription={s} />

        <View className="mt-1 gap-2.5">
          <Button label={t('common.edit')} variant="ink" onPress={() => setEditing(true)} />
          <View className="flex-row gap-2.5">
            {s.status === 'active' ? (
              <Button label={t('subscription.pause')} variant="secondary" className="flex-1" loading={update.isPending} onPress={() => update.mutate(PAUSED)} />
            ) : (
              <Button label={t('subscription.resume')} variant="secondary" className="flex-1" loading={update.isPending} onPress={() => update.mutate(ACTIVE)} />
            )}
            {s.status !== 'cancelled' ? (
              <Button label={t('subscription.cancelSub')} variant="secondary" className="flex-1" onPress={() => update.mutate(CANCELLED)} />
            ) : null}
          </View>
          <Button
            label={confirmDelete ? t('common.confirmDelete') : t('subscription.delete')}
            variant="ghostDanger"
            loading={remove.isPending}
            onPress={() => (confirmDelete ? remove.mutate(undefined, { onSuccess: () => router.back() }) : setConfirmDelete(true))}
          />
          <ErrorMessage error={update.error ?? remove.error} />
        </View>
      </ScrollView>
    </View>
  );
}
