import { View } from 'react-native';

import { AppText } from './AppText';
import { Button } from './Button';

export function EmptyState({ message, action }: { message: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View className="items-center gap-4 py-12">
      <AppText variant="muted" className="text-center">{message}</AppText>
      {action ? <Button label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}
