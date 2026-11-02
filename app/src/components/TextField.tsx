import { TextInput, View, type TextInputProps } from 'react-native';

import { cn } from '@/lib/cn';

import { AppText } from './AppText';

type Props = TextInputProps & { label: string; error?: string };

export function TextField({ label, error, className, ...input }: Props) {
  return (
    <View className="gap-1.5">
      <AppText variant="muted" className="font-medium text-[13px]">{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#9AA3AF"
        className={cn(
          'h-12 rounded-xl bg-surface px-3.5 font-sans text-base text-ink dark:bg-surface-dark dark:text-ink-dark',
          error ? 'border-[1.5px] border-danger' : 'border border-line dark:border-line-dark',
          className,
        )}
        {...input}
      />
      {error ? <AppText variant="error">{error}</AppText> : null}
    </View>
  );
}
