import { Text, type TextProps } from 'react-native';

import { cn } from '@/lib/cn';

type Variant = 'title' | 'heading' | 'body' | 'muted' | 'error';

const variants: Record<Variant, string> = {
  title: 'font-display text-[24px] text-ink dark:text-ink-dark',
  heading: 'font-heading text-[17px] text-ink dark:text-ink-dark',
  body: 'font-sans text-base text-ink dark:text-ink-dark',
  muted: 'font-sans text-sm text-muted dark:text-muted-dark',
  error: 'font-sans text-sm text-danger dark:text-danger-dark',
};

type Props = TextProps & { variant?: Variant; numeric?: boolean };

/** `numeric` aligns digits (tabular-nums) for money and dates. */
export function AppText({ variant = 'body', numeric = false, className, style, ...props }: Props) {
  return (
    <Text
      className={cn(variants[variant], className)}
      style={numeric ? [{ fontVariant: ['tabular-nums'] }, style] : style}
      {...props}
    />
  );
}
