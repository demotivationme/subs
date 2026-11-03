import { Pressable, Text, View } from 'react-native';

import { cn } from '@/lib/cn';

const SELECTED_SHADOW = {
  shadowColor: '#14171C',
  shadowOpacity: 0.08,
  shadowRadius: 2,
  shadowOffset: { width: 0, height: 1 },
  elevation: 1,
} as const;

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
            // A plain style, not `shadow-sm`: that class uses CSS variables, and adding it after the
            // first render makes NativeWind remount the button on native (and it broke Stats' switch).
            style={selected ? SELECTED_SHADOW : undefined}
            className={cn('h-10 flex-1 items-center justify-center rounded-[10px]', selected && 'bg-surface dark:bg-surface-dark')}>
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
