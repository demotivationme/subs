import { Pressable } from 'react-native';

import { AppText } from './AppText';

export function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={onPress} className="py-2">
      <AppText className="font-semibold text-accent dark:text-accent-dark">{label}</AppText>
    </Pressable>
  );
}
