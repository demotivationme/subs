import { Pressable, Text, View } from 'react-native';

import { cn } from '@/lib/cn';

import { AppText } from './AppText';

type Props<T extends string> = {
  label?: string;
  options: readonly { value: T; label: string }[];
  value: readonly T[];
  onChange: (value: T[]) => void;
};

export function MultiChoice<T extends string>({ label, options, value, onChange }: Props<T>) {
  const toggle = (option: T) =>
    onChange(value.includes(option) ? value.filter((v) => v !== option) : [...value, option]);

  return (
    <View className="gap-1">
      {label ? <AppText variant="muted" className="font-medium text-[13px]">{label}</AppText> : null}
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => {
          const checked = value.includes(option.value);
          return (
            <Pressable
              key={option.value}
              accessibilityRole="checkbox"
              accessibilityLabel={option.label}
              accessibilityState={{ checked }}
              onPress={() => toggle(option.value)}
              className={cn(
                'h-9 items-center justify-center rounded-full px-3.5',
                checked ? 'bg-ink dark:bg-ink-dark' : 'border border-line bg-surface dark:border-line-dark dark:bg-surface-dark',
              )}>
              <Text className={cn('font-medium text-sm', checked ? 'text-surface dark:text-ground-dark' : 'text-ink dark:text-ink-dark')}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
