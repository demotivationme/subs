import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, useColorScheme, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useMe } from '@/api/me';
import { useStats } from '@/api/stats';
import type { Stats, StatsPayment, StatsSavingsItem } from '@/api/types';
import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Loading } from '@/components/Loading';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { ServiceIcon } from '@/components/ServiceIcon';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { formatDate, todayIso } from '@/lib/dates';
import { formatMoney } from '@/lib/money';

type Mode = 'month' | 'year';

const CHART_HEIGHT = 132;
const MIN_BAR = 4;
const MINUS = '−';
// Static class names so NativeWind can see them.
const DOTS = ['bg-cat-1', 'bg-cat-2', 'bg-cat-3', 'bg-cat-4', 'bg-cat-5'] as const;
const dot = (index: number) => DOTS[index] ?? 'bg-cat-rest';
const SUMMARY = 'summary';
const LONG = 'long';
const NARROW = 'narrow';
const MONTH: Mode = 'month';
const YEAR: Mode = 'year';
const SWATCH_PAID = 'bg-accent-soft dark:bg-accent-soft-dark';
const SWATCH_NOW = 'bg-accent dark:bg-accent-dark';
const SWATCH_EXPECTED = 'border border-dashed border-muted bg-transparent dark:border-muted-dark';
const CHEVRON_BACK = 'chevron-back';
const CHEVRON_FORWARD = 'chevron-forward';

function monthName(month: number, locale: string, style: 'long' | 'narrow'): string {
  return new Intl.DateTimeFormat(locale, { month: style, timeZone: 'UTC' }).format(new Date(Date.UTC(2026, month - 1, 1)));
}

function Stepper({ label, previousLabel, nextLabel, onPrevious, onNext, nextDisabled }: {
  label: string;
  previousLabel: string;
  nextLabel: string;
  onPrevious: () => void;
  onNext: () => void;
  nextDisabled: boolean;
}) {
  const ink = useColorScheme() === 'dark' ? '#F1F3F5' : '#14171C';
  const muted = '#9AA3AF';
  return (
    <View className="flex-row items-center justify-between">
      <Pressable accessibilityRole="button" accessibilityLabel={previousLabel} onPress={onPrevious} hitSlop={8} className="h-10 w-10 items-center justify-center rounded-full bg-surface2 dark:bg-surface2-dark">
        <Ionicons name={CHEVRON_BACK} size={18} color={ink} />
      </Pressable>
      <AppText variant="heading">{label}</AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={nextLabel}
        accessibilityState={{ disabled: nextDisabled }}
        disabled={nextDisabled}
        onPress={onNext}
        hitSlop={8}
        className={cn('h-10 w-10 items-center justify-center rounded-full bg-surface2 dark:bg-surface2-dark', nextDisabled && 'opacity-40')}>
        <Ionicons name={CHEVRON_FORWARD} size={18} color={nextDisabled ? muted : ink} />
      </Pressable>
    </View>
  );
}

function YearChart({ stats, currentMonth, locale, money, onSelect }: {
  stats: Stats;
  currentMonth: number | null;
  locale: string;
  money: (minor: number) => string;
  onSelect: (month: number) => void;
}) {
  const { t } = useTranslation();
  const today = Number(stats.today.slice(0, 4));
  const max = Math.max(1, ...stats.months.map((m) => m.paid + m.expected));
  return (
    <View className="gap-3">
      <View className="flex-row items-end gap-1.5" style={{ height: CHART_HEIGHT + 28 }}>
        {stats.months.map((m) => {
          const total = m.paid + m.expected;
          const isCurrent = m.month === currentMonth;
          const isFuture = stats.year > today || (stats.year === today && currentMonth !== null && m.month > currentMonth);
          const name = monthName(m.month, locale, LONG);
          const label = t(isFuture ? 'stats.barLabelExpected' : 'stats.barLabel', { month: `${name} ${stats.year}`, amount: money(total) });
          return (
            <Pressable key={m.month} accessibilityRole="button" accessibilityLabel={label} onPress={() => onSelect(m.month)} className="flex-1 items-center justify-end">
              {isCurrent ? (
                <View className="mb-1 rounded-md bg-ink px-1.5 py-0.5 dark:bg-ink-dark">
                  <AppText testID="bubble" numeric className="text-[10px] text-surface dark:text-ground-dark" numberOfLines={1}>{money(total)}</AppText>
                </View>
              ) : null}
              <View
                className={cn(
                  'w-full rounded-md',
                  isCurrent && 'bg-accent dark:bg-accent-dark',
                  !isCurrent && !isFuture && 'bg-accent-soft dark:bg-accent-soft-dark',
                  isFuture && 'border border-dashed border-muted bg-transparent dark:border-muted-dark',
                )}
                style={{ height: Math.max(MIN_BAR, Math.round((total / max) * CHART_HEIGHT)) }}
              />
            </Pressable>
          );
        })}
      </View>
      <View className="flex-row gap-1.5">
        {stats.months.map((m) => (
          <AppText key={m.month} variant="muted" className="flex-1 text-center text-[11px]">{monthName(m.month, locale, NARROW)}</AppText>
        ))}
      </View>
      <View className="flex-row flex-wrap gap-4">
        <Legend swatch={SWATCH_PAID} label={t('stats.legendPaid')} />
        <Legend swatch={SWATCH_NOW} label={t('stats.legendThisMonth')} />
        <Legend swatch={SWATCH_EXPECTED} label={t('stats.legendExpected')} />
      </View>
    </View>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className={cn('h-2.5 w-2.5 rounded-[3px]', swatch)} />
      <AppText variant="muted" className="text-xs">{label}</AppText>
    </View>
  );
}

function PaymentRow({ payment, currency, locale, services }: { payment: StatsPayment; currency: string; locale: string; services: Map<number, StatsSavingsItem['service']> }) {
  const { t } = useTranslation();
  const differs = payment.currency !== currency;
  return (
    <View testID={`payment-${payment.subscription_id}`} className="flex-row items-center gap-3 border-b border-line py-3 dark:border-line-dark">
      <ServiceIcon service={services.get(payment.subscription_id) ?? { name: payment.name, logo_url: null }} size={36} />
      <View className="flex-1 gap-0.5">
        <AppText className="font-medium">{payment.name}</AppText>
        <View className="flex-row items-center gap-2">
          <AppText variant="muted" numeric className="text-[13px]">{formatDate(payment.date, locale)}</AppText>
          {payment.state === 'expected' ? (
            <View className="rounded-full bg-surface2 px-2 py-0.5 dark:bg-surface2-dark">
              <AppText variant="muted" className="text-[11px]">{t('stats.expected')}</AppText>
            </View>
          ) : null}
        </View>
      </View>
      <View className="items-end">
        <AppText numeric className="font-semibold">{formatMoney(payment.amount, payment.currency, locale)}</AppText>
        {differs && payment.converted !== null ? <AppText numeric variant="muted" className="text-[13px]">{formatMoney(payment.converted, currency, locale)}</AppText> : null}
      </View>
    </View>
  );
}

function SavingsCard({ stats, locale, money }: { stats: Stats; locale: string; money: (minor: number) => string }) {
  const { t } = useTranslation();
  const { savings } = stats;
  if (savings.items.length === 0) {
    return (
      <Card heading={t('stats.savedTitle')}>
        <AppText variant="muted">{t('stats.savedEmpty')}</AppText>
      </Card>
    );
  }
  const describe = (item: StatsSavingsItem) => {
    const since = formatDate(item.since, locale);
    if (item.until) {
      const until = formatDate(item.until, locale);
      return item.inactive_status === 'paused' ? t('stats.pausedRange', { since, until }) : t('stats.cancelledRange', { since, until });
    }
    const monthly = money(item.monthly);
    return item.inactive_status === 'paused' ? t('stats.pausedSince', { since, monthly }) : t('stats.cancelledSince', { since, monthly });
  };
  return (
    <View className="gap-3 rounded-[24px] bg-accent p-5 dark:border dark:border-hero-border-dark dark:bg-hero-dark">
      <AppText className="font-medium text-sm text-white opacity-90 dark:text-hero-label-dark dark:opacity-100">{t('stats.savedTitle')}</AppText>
      <AppText numeric className="font-display text-[40px] text-white dark:text-ink-dark">{money(savings.total)}</AppText>
      <AppText className="text-white opacity-90 dark:text-hero-label-dark dark:opacity-100">
        {t('stats.keep', { monthly: money(savings.monthly), yearly: money(savings.yearly) })}
      </AppText>
      <View className="mt-1 gap-2.5">
        {savings.items.map((item) => (
          <View key={item.subscription_id} className="flex-row items-center gap-3 rounded-tile bg-white/15 px-3 py-2.5 dark:bg-white/10">
            <ServiceIcon service={item.service ?? { name: item.name, logo_url: null }} size={36} />
            <View className="flex-1 gap-0.5">
              <AppText className="font-semibold text-white dark:text-ink-dark">{item.name}</AppText>
              <AppText className="text-[13px] text-white opacity-90 dark:text-hero-label-dark dark:opacity-100">{describe(item)}</AppText>
            </View>
            <AppText numeric className="font-semibold text-white dark:text-ink-dark">{t('stats.savedAmount', { amount: money(item.saved) })}</AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

function CategoryCard({ stats, money }: { stats: Stats; money: (minor: number) => string }) {
  const { t } = useTranslation();
  return (
    <Card heading={t('stats.byCategory')}>
      <View className="gap-3">
        {stats.by_category.map((c, index) => {
          const change = c.change === 0 ? t('stats.noChange') : `${c.change < 0 ? MINUS : '+'}${money(Math.abs(c.change))}`;
          return (
            <View
              key={c.category_id}
              accessible
              accessibilityLabel={t('stats.categoryRow', { label: c.label, monthly: money(c.monthly), change })}
              className="flex-row items-center gap-2.5">
              <View className={cn('h-2.5 w-2.5 rounded-[3px]', dot(index))} />
              <AppText className="flex-1 text-sm">{c.label}</AppText>
              <AppText numeric className="font-semibold text-sm">{money(c.monthly)}</AppText>
              <AppText
                numeric
                className={cn(
                  'w-20 text-right text-sm',
                  c.change < 0 && 'text-accent-strong dark:text-accent-dark',
                  c.change > 0 && 'text-warn dark:text-warn-dark',
                  c.change === 0 && 'text-muted dark:text-muted-dark',
                )}>
                {change}
              </AppText>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

export default function StatsScreen() {
  const { t } = useTranslation();
  const locale = useLocale();
  const timezone = useMe().data?.timezone;
  const today = todayIso(timezone);
  const thisYear = Number(today.slice(0, 4));
  const thisMonth = Number(today.slice(5, 7));

  const [mode, setMode] = useState<Mode>(YEAR);
  // Until the user navigates, follow "today" in the account timezone (it may arrive after the first render).
  const [pickedYear, setYear] = useState<number | null>(null);
  const [pickedMonth, setMonth] = useState<number | null>(null);
  const year = pickedYear ?? thisYear;
  const month = pickedMonth ?? thisMonth;

  const query = useStats(year, mode === MONTH ? month : undefined);

  if (query.isPending) return <Loading />;
  if (query.isError && !query.data) {
    return (
      <Screen>
        <ErrorMessage error={query.error} />
        <Button label={t('common.retry')} variant="secondary" onPress={() => void query.refetch()} />
      </Screen>
    );
  }

  const stats = query.data as Stats;
  const money = (minor: number) => formatMoney(minor, stats.currency, locale);
  const selected = stats.months[month - 1];
  const services = new Map<number, StatsSavingsItem['service']>(stats.savings.items.map((i) => [i.subscription_id, i.service]));

  const shiftMonth = (delta: number) => {
    const index = year * 12 + (month - 1) + delta;
    setYear(Math.floor(index / 12));
    setMonth((index % 12) + 1);
  };
  const jumpTo = (m: number) => {
    setMonth(m);
    setMode(MONTH);
  };

  return (
    <Screen>
      <SegmentedControl
        options={[{ value: MONTH, label: t('stats.month') }, { value: YEAR, label: t('stats.year') }]}
        value={mode}
        onChange={setMode}
      />

      {mode === YEAR ? (
        <Card>
          {/* The chart summary sits on the visible totals; the bars stay separate, individually focusable siblings. */}
          <View
            testID="chart-summary"
            accessible
            accessibilityRole={SUMMARY}
            accessibilityLabel={t('stats.chartLabel', { year, paid: money(stats.spent_so_far), projected: money(stats.projected_year) })}
            className="gap-1">
            <AppText variant="muted">{t('stats.spentIn', { year })}</AppText>
            <AppText numeric className="font-display text-[36px]">{money(stats.spent_so_far)}</AppText>
            <AppText variant="muted">{t('stats.onTrack', { amount: money(stats.projected_year) })}</AppText>
          </View>
          <YearChart stats={stats} currentMonth={year === thisYear ? thisMonth : null} locale={locale} money={money} onSelect={jumpTo} />
          <Stepper
            label={String(year)}
            previousLabel={t('stats.previousYear')}
            nextLabel={t('stats.nextYear')}
            onPrevious={() => setYear(year - 1)}
            onNext={() => setYear(year + 1)}
            nextDisabled={year >= thisYear}
          />
        </Card>
      ) : (
        <Card>
          <Stepper
            label={t('stats.monthTitle', { month: monthName(month, locale, LONG), year })}
            previousLabel={t('stats.previousMonth')}
            nextLabel={t('stats.nextMonth')}
            onPrevious={() => shiftMonth(-1)}
            onNext={() => shiftMonth(1)}
            nextDisabled={year * 12 + month >= thisYear * 12 + 12}
          />
          <View className="gap-1">
            <AppText variant="muted">{t('stats.monthTotal')}</AppText>
            <AppText numeric className="font-display text-[36px]">{money(selected.paid + selected.expected)}</AppText>
          </View>
          {stats.payments === undefined ? null : stats.payments.length === 0 ? (
            <AppText variant="muted">{t('stats.noPayments')}</AppText>
          ) : (
            <View>
              {stats.payments.map((p) => (
                <PaymentRow key={`${p.subscription_id}-${p.date}`} payment={p} currency={stats.currency} locale={locale} services={services} />
              ))}
            </View>
          )}
        </Card>
      )}

      {stats.unconverted.length > 0 ? <Banner tone="warning" message={t('dashboard.unconverted', { count: stats.unconverted.length })} /> : null}

      <SavingsCard stats={stats} locale={locale} money={money} />

      {stats.by_category.length > 0 ? <CategoryCard stats={stats} money={money} /> : null}

      <View className="flex-row gap-3">
        <Card heading={t('stats.biggest')} className="flex-1">
          {stats.biggest ? (
            <View className="gap-0.5">
              <AppText className="font-semibold">{stats.biggest.name}</AppText>
              <AppText numeric variant="muted">{t('dashboard.perMonth', { amount: money(stats.biggest.monthly) })}</AppText>
            </View>
          ) : null}
        </Card>
        <Card heading={t('stats.next12')} className="flex-1">
          <View className="gap-0.5">
            <AppText numeric className="font-semibold">{money(stats.next_12_months)}</AppText>
            <AppText variant="muted">{t('stats.ifNothingChanges')}</AppText>
          </View>
        </Card>
      </View>
    </Screen>
  );
}
