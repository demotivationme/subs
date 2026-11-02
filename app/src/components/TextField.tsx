import type { ReactNode } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { cn } from '@/lib/cn';

import { AppText } from './AppText';

type Props = TextInputProps & { label: string; error?: string; hint?: string; trailing?: ReactNode };

/** `trailing` is a control (e.g. show/hide password) drawn inside the input's right edge. */
export function TextField({ label, error, hint, trailing, className, ...input }: Props) {
  return (
    <View className="gap-1.5">
      <AppText variant="muted" className="font-medium text-[13px]">{label}</AppText>
      <View>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor="#9AA3AF"
          className={cn(
            'h-12 rounded-xl bg-surface px-3.5 font-sans text-base text-ink dark:bg-surface-dark dark:text-ink-dark',
            error ? 'border-[1.5px] border-danger' : 'border border-line dark:border-line-dark',
            trailing ? 'pr-[52px]' : null,
            className,
          )}
          {...input}
        />
        {trailing ? <View className="absolute right-0.5 top-0.5">{trailing}</View> : null}
      </View>
      {error ? <AppText variant="error">{error}</AppText> : null}
      {!error && hint ? <AppText variant="muted" className="text-[13px]">{hint}</AppText> : null}
    </View>
  );
}
