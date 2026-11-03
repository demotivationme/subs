import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useDashboard } from '@/api/dashboard';
import { useMe } from '@/api/me';
import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ErrorMessage } from '@/components/ErrorMessage';
import { ListRow } from '@/components/ListRow';
import { Loading } from '@/components/Loading';
import { Screen } from '@/components/Screen';
import { SpendChart } from '@/components/SpendChart';
import { TextLink } from '@/components/TextLink';
import { VerifyEmailBanner } from '@/components/VerifyEmailBanner';
import { cn } from '@/lib/cn';
import { useLocale } from '@/i18n/useLocale';
import { dateTile, daysBetween, formatDate, todayIso } from '@/lib/dates';
import { formatMoney } from '@/lib/money';

const NEW_SUBSCRIPTION = '/subscriptions/new';
const SUBSCRIPTIONS = '/subscriptions';

function Pill({ label }: { label: string }) {
  return (
    <View className="rounded-full bg-white/15 px-3 py-1.5 dark:bg-white/10">
      <AppText numeric className="text-sm text-white dark:text-ink-dark">{label}</AppText>
    </View>
  );
}

function DateTile({ date, soon, locale }: { date: string; soon: boolean; locale: string }) {
  const { month, day } = dateTile(date, locale);
  return (
    <View
      className={cn('h-11 w-11 items-center justify-center rounded-xl', soon ? 'bg-accent-soft dark:bg-accent-soft-dark' : 'bg-surface2 dark:bg-surface2-dark')}>
      {/* No fixed line heights: below the font's own height, iOS clips the glyph tops. */}
      <AppText className={cn('font-bold text-[10px]', soon ? 'text-accent dark:text-accent-dark' : '')}>{month}</AppText>
      <AppText numeric className={cn('-mt-0.5 font-display text-base', soon ? 'text-accent dark:text-accent-dark' : '')}>{day}</AppText>
    </View>
  );
}

export default function DashboardScreen() {
  const { t } = useTranslation();
  const locale = useLocale();
  const dashboard = useDashboard();
  const timezone = useMe().data?.timezone;

  if (dashboard.isPending) return <Loading />;

  if (dashboard.isError) {
    return (
      <Screen>
        <ErrorMessage error={dashboard.error} />
        <Button label={t('common.retry')} variant="secondary" onPress={() => void dashboard.refetch()} />
      </Screen>
    );
  }

  const d = dashboard.data;
  const today = todayIso(timezone);
  const money = (minor: number, currency = d.currency) => formatMoney(minor, currency, locale);
  const addFirst = () => router.push(NEW_SUBSCRIPTION);
  const seeAll = () => router.push(SUBSCRIPTIONS);
  const open = (id: number) => router.push(`/subscriptions/${id}`);

  /** "Today", "Tomorrow", "In 7 days"; a past date (clock skew) falls back to the date itself. */
  const relative = (date: string) => {
    const days = daysBetween(today, date);
    if (days < 0) return formatDate(date, locale);
    if (days === 0) return t('dashboard.today');
    if (days === 1) return t('dashboard.tomorrow');
    return t('dashboard.inDays', { count: days });
  };

  return (
    <Screen>
      <VerifyEmailBanner />
      {d.count === 0 ? (
        <EmptyState message={t('dashboard.empty')} action={{ label: t('dashboard.addFirst'), onPress: addFirst }} />
      ) : (
        <>
          <View className="gap-1 rounded-[24px] bg-accent p-5 dark:border dark:border-hero-border-dark dark:bg-hero-dark">
            <AppText className="font-medium text-sm text-white opacity-90 dark:text-hero-label-dark dark:opacity-100">{t('dashboard.heroLabel')}</AppText>
            <AppText numeric className="font-display text-[44px] text-white dark:text-ink-dark">{money(d.monthly_total)}</AppText>
            <View className="mt-2.5 flex-row flex-wrap gap-2">
              <Pill label={t('dashboard.perYearPill', { amount: money(d.yearly_total) })} />
              <Pill label={t('dashboard.activePill', { count: d.count })} />
            </View>
          </View>

          {d.unconverted.length > 0 ? <Banner tone="warning" message={t('dashboard.unconverted', { count: d.unconverted.length })} /> : null}

          <Card heading={t('dashboard.byCategory')}>
            <SpendChart
              items={d.by_category.map((c) => ({ key: String(c.category_id), label: c.label, formatted: money(c.monthly), percent: c.percent }))}
            />
          </Card>

          <View className="gap-2.5">
            <View className="flex-row items-center justify-between">
              <AppText variant="heading">{t('dashboard.upcoming')}</AppText>
              <TextLink label={t('dashboard.seeAll')} onPress={seeAll} />
            </View>
            {d.upcoming.length === 0 ? (
              <AppText variant="muted">{t('dashboard.noUpcoming')}</AppText>
            ) : (
              d.upcoming.map((u) => (
                <Pressable
                  key={`${u.subscription_id}-${u.date}`}
                  accessibilityRole="button"
                  accessibilityLabel={t('dashboard.upcomingItem', { name: u.name, when: relative(u.date), amount: money(u.amount, u.currency) })}
                  onPress={() => open(u.subscription_id)}
                  className="flex-row items-center gap-3 rounded-tile bg-surface px-3.5 py-3 dark:bg-surface-dark">
                  <DateTile date={u.date} soon={daysBetween(today, u.date) <= 1} locale={locale} />
                  <View className="flex-1 gap-0.5">
                    <AppText className="font-semibold">{u.name}</AppText>
                    <AppText variant="muted" className="text-[13px]">{relative(u.date)}</AppText>
                  </View>
                  <AppText numeric className="font-semibold">{money(u.amount, u.currency)}</AppText>
                </Pressable>
              ))
            )}
          </View>

          {d.most_expensive.length > 0 ? (
            <Card heading={t('dashboard.mostExpensive')}>
              {d.most_expensive.map((m) => (
                <ListRow key={m.subscription_id} title={m.name} value={t('dashboard.perMonth', { amount: money(m.monthly) })} onPress={() => open(m.subscription_id)} />
              ))}
            </Card>
          ) : null}
        </>
      )}
    </Screen>
  );
}
