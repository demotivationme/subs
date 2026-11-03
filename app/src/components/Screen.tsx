import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { OfflineBanner } from './OfflineBanner';

/** For scroll views under a native header: iOS 26's header is translucent, so let iOS inset the content below it. */
export const BELOW_HEADER = 'automatic';

/** Page background and padding; scroll={false} for screens that render their own FlatList. */
export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const body = (
    <View className={scroll ? 'gap-4 p-4' : 'flex-1 gap-4 p-4'}>
      <OfflineBanner />
      {children}
    </View>
  );
  return (
    <View className="flex-1 bg-ground dark:bg-ground-dark">
      {scroll ? (
        <ScrollView contentContainerClassName="pb-12" contentInsetAdjustmentBehavior={BELOW_HEADER} keyboardShouldPersistTaps="handled">
          {body}
        </ScrollView>
      ) : (
        body
      )}
    </View>
  );
}
