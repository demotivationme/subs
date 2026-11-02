import { Pressable, Text, View } from 'react-native';

import { cn } from '@/lib/cn';

import { AppText } from './AppText';

type Props<T extends string> = {
  label?: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

/** Pill chips for sort and filter choices. */
export function SegmentedChoice<T extends string>({ label, options, value, onChange }: Props<T>) {
  return (
    <View className="gap-1.5">
      {label ? <AppText variant="muted" className="font-medium text-[13px]">{label}</AppText> : null}
      <View className="flex-row flex-wrap gap-2">
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
                'h-9 items-center justify-center rounded-full px-3.5',
                selected ? 'bg-ink dark:bg-ink-dark' : 'border border-line bg-surface dark:border-line-dark dark:bg-surface-dark',
              )}>
              <Text
                className={cn(
                  'font-medium text-sm',
                  selected ? 'text-surface dark:text-ground-dark' : 'text-ink dark:text-ink-dark',
                )}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
