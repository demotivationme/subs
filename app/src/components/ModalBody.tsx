import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cn } from '@/lib/cn';

/** The page of a full-screen Modal, padded clear of the notch and the home indicator. */
export function ModalBody({ children, className }: { children: ReactNode; className?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{ paddingTop: Math.max(insets.top, 48), paddingBottom: Math.max(insets.bottom, 16) }}
      className={cn('flex-1 gap-3 bg-ground px-4 dark:bg-ground-dark', className)}>
      {children}
    </View>
  );
}
