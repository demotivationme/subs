import { Ionicons } from '@expo/vector-icons';
import { useColorScheme, View } from 'react-native';

import { cn } from '@/lib/cn';

import { AppText } from './AppText';
import { Button } from './Button';

type Props = { tone?: 'info' | 'warning'; message: string; action?: { label: string; onPress: () => void } };

export function Banner({ tone = 'info', message, action }: Props) {
  const warning = tone === 'warning';
  const iconColor = useColorScheme() === 'dark' ? '#F0A44B' : '#9A4A06';
  return (
    <View
      accessibilityRole="alert"
      className={cn(
        'gap-3 rounded-2xl p-3.5',
        warning ? 'bg-warn-soft dark:bg-warn-soft-dark' : 'bg-accent-soft dark:bg-accent-soft-dark',
      )}>
      <View className="flex-row items-start gap-2.5">
        {warning ? <Ionicons name="warning" size={20} color={iconColor} /> : null}
        <AppText className={cn('flex-1', warning && 'text-warn-ink dark:text-warn-ink-dark')}>{message}</AppText>
      </View>
      {action ? <Button label={action.label} variant="secondary" onPress={action.onPress} /> : null}
    </View>
  );
}
