import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AppText } from './AppText';

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <AppText variant="heading">{title}</AppText>
      {children}
    </View>
  );
}
