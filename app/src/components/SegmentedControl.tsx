import { Pressable, Text, View } from 'react-native';

import { cn } from '@/lib/cn';

type Props<T extends string> = {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

/** Equal-width group for mutually exclusive modes (Weekly / Monthly / Yearly). */
export function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View className="flex-row rounded-[14px] bg-surface2 p-1 dark:bg-surface2-dark">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            className={cn(
              'h-10 flex-1 items-center justify-center rounded-[10px]',
              selected && 'bg-surface shadow-sm dark:bg-surface-dark',
            )}>
            <Text
              className={cn(
                'text-sm',
                selected ? 'font-semibold text-ink dark:text-ink-dark' : 'font-medium text-muted dark:text-muted-dark',
              )}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
