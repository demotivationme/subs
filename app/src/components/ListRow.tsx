import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from './AppText';

type Props = {
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  right?: ReactNode;
  /** Start slot for a ServiceIcon or date tile. */
  leading?: ReactNode;
};

export function ListRow({ title, subtitle, value, onPress, right, leading }: Props) {
  const content = (
    <View className="min-h-12 flex-row items-center gap-3 border-b border-line py-3 dark:border-line-dark">
      {leading}
      <View className="flex-1 gap-0.5">
        <AppText className="font-medium">{title}</AppText>
        {subtitle ? <AppText variant="muted">{subtitle}</AppText> : null}
      </View>
      {value ? <AppText numeric className="font-semibold">{value}</AppText> : null}
      {right}
    </View>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress}>
      {content}
    </Pressable>
  ) : (
    content
  );
}
