import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Subscription } from '@/api/types';
import { useLocale } from '@/i18n/useLocale';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { periodLabel } from '@/lib/period';

import { AppText } from './AppText';
import { ServiceIcon } from './ServiceIcon';

const INACTIVE_OPACITY = 0.72;

export function SubscriptionRow({ subscription: s, onPress }: { subscription: Subscription; onPress: () => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const price = formatMoney(s.amount, s.currency, locale);
  const period = periodLabel(t, s.period, s.interval_count);
  const inactive = s.status !== 'active';
  const status = t(`status.${s.status}`);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('subscriptions.rowLabel', { name: s.service.name, price: `${price} ${period}`, status })}
      onPress={onPress}>
      <View
        testID={`subscription-row-${s.id}`}
        style={inactive ? { opacity: INACTIVE_OPACITY } : undefined}
        className="flex-row items-center gap-3 rounded-tile bg-surface px-3.5 py-3 dark:bg-surface-dark">
        <ServiceIcon service={s.service} size={40} />
        <View className="flex-1 gap-0.5">
          <AppText className="font-semibold">{s.service.name}</AppText>
          <AppText variant="muted" className="text-[13px]">
            {t('subscriptions.rowMeta', { category: s.category.label, date: formatDate(s.next_payment_date, locale) })}
          </AppText>
        </View>
        <View className="items-end gap-0.5">
          <AppText numeric className="font-semibold">{price}</AppText>
          <AppText variant="muted" className="text-xs">{period}</AppText>
          {inactive ? (
            <View className="mt-0.5 rounded-full bg-warn-soft px-2 py-0.5 dark:bg-warn-soft-dark">
              <AppText className="font-semibold text-[11px] text-warn-ink dark:text-warn-ink-dark">{status}</AppText>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
