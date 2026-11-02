import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AppText } from './AppText';

/** Uppercase caption over a white rounded card whose rows are divided by hairlines. */
export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <AppText variant="muted" className="px-1 font-semibold text-xs uppercase tracking-wider">
        {title}
      </AppText>
      <View className="gap-1 rounded-card bg-surface px-4 py-1 dark:bg-surface-dark">{children}</View>
    </View>
  );
}
