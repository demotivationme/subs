import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from './AppText';

export type SpendChartItem = { key: string; label: string; formatted: string; percent: number };

// Static class names so NativeWind can see them; cat.rest takes everything past the fifth.
const DOTS = ['bg-cat-1', 'bg-cat-2', 'bg-cat-3', 'bg-cat-4', 'bg-cat-5'] as const;
const dot = (index: number) => DOTS[index] ?? 'bg-cat-rest';

/** Share of monthly spend per category as one stacked bar plus a legend. Swap the internals for a chart library later; keep the props. */
export function SpendChart({ items }: { items: SpendChartItem[] }) {
  const { t } = useTranslation();
  return (
    <View className="gap-3.5">
      <View accessible accessibilityRole="image" accessibilityLabel={t('dashboard.chartLabel')} className="h-3 flex-row gap-0.5 overflow-hidden rounded-md">
        {items.map((item, index) => (
          <View key={item.key} className={dot(index)} style={{ flexGrow: Math.max(0, item.percent), flexBasis: 0 }} />
        ))}
      </View>
      <View className="gap-2.5">
        {items.map((item, index) => (
          <View
            key={item.key}
            accessible
            accessibilityLabel={t('dashboard.chartItem', { label: item.label, amount: item.formatted, percent: item.percent })}
            className="flex-row items-center gap-2.5">
            <View className={`h-2.5 w-2.5 rounded-[3px] ${dot(index)}`} />
            <AppText className="flex-1 text-sm">{item.label}</AppText>
            <AppText numeric className="font-semibold text-sm">{item.formatted}</AppText>
            <AppText numeric variant="muted" className="w-12 text-right">{t('dashboard.percent', { percent: Math.round(item.percent) })}</AppText>
          </View>
        ))}
      </View>
    </View>
  );
}
