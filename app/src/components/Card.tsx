import type { ReactNode } from 'react';
import { View } from 'react-native';

import { cn } from '@/lib/cn';

import { AppText } from './AppText';

export function Card({ heading, children, className }: { heading?: string; children: ReactNode; className?: string }) {
  return (
    <View className={cn('gap-3 rounded-card bg-surface p-4 dark:bg-surface-dark', className)}>
      {heading ? <AppText variant="heading">{heading}</AppText> : null}
      {children}
    </View>
  );
}
