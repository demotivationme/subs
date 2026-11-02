import { ActivityIndicator, Pressable, Text, useColorScheme } from 'react-native';

import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const box: Record<Variant, string> = {
  primary: 'bg-accent dark:bg-accent-dark',
  secondary: 'border border-line bg-surface dark:border-line-dark dark:bg-surface-dark',
  danger: 'bg-danger',
  ghost: 'bg-transparent',
};

const label: Record<Variant, string> = {
  primary: 'text-surface dark:text-ground-dark',
  secondary: 'text-ink dark:text-ink-dark',
  danger: 'text-surface',
  ghost: 'text-accent dark:text-accent-dark',
};

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
};

export function Button({ label: text, onPress, variant = 'primary', loading = false, disabled = false, className }: Props) {
  const inactive = disabled || loading;
  const dark = useColorScheme() === 'dark';
  // primary/danger sit on a solid fill (white spinner); secondary/ghost use the ink / accent token colors
  const spinner =
    variant === 'primary' || variant === 'danger'
      ? '#FFFFFF'
      : variant === 'ghost'
        ? dark ? '#34C08E' : '#0B7A57'
        : dark ? '#F1F3F5' : '#14171C';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      className={cn('h-12 flex-row items-center justify-center rounded-xl px-4', box[variant], inactive && 'opacity-[0.45]', className)}>
      {loading ? (
        <ActivityIndicator color={spinner} />
      ) : (
        <Text className={cn('font-semibold text-base', label[variant])}>{text}</Text>
      )}
    </Pressable>
  );
}
