import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** A step's scrolling body with an optional sticky footer (the primary action). */
export function StepFrame({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1">
      <ScrollView className="flex-1" contentContainerClassName="gap-5 px-4 pb-8 pt-2" keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      {footer ? <View style={{ paddingBottom: Math.max(insets.bottom, 24) }} className="border-t border-line bg-surface px-4 pt-3 dark:border-line-dark dark:bg-surface-dark">
          {footer}
        </View> : null}
    </View>
  );
}
