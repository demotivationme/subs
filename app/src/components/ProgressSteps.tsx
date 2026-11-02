import { View } from 'react-native';

import { cn } from '@/lib/cn';

/** Equal bars, accent up to `current` (1-based). */
export function ProgressSteps({ count, current }: { count: number; current: number }) {
  return (
    <View className="flex-row gap-1.5">
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          testID={`step-${i + 1}`}
          className={cn('h-1 flex-1 rounded-full', i < current ? 'bg-accent dark:bg-accent-dark' : 'bg-line dark:bg-line-dark')}
        />
      ))}
    </View>
  );
}
