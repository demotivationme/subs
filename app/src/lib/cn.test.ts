import { cn } from './cn';

test('a className overrides the variant it extends', () => {
  expect(cn('font-sans text-base text-ink dark:text-ink-dark', 'font-display text-[44px] text-muted dark:text-muted-dark')).toBe(
    'font-display text-[44px] text-muted dark:text-muted-dark',
  );
  expect(cn('font-sans text-sm text-muted', 'text-xs')).toBe('font-sans text-muted text-xs');
  expect(cn('text-2xl text-ink', 'text-[26px]')).toBe('text-ink text-[26px]');
});

test('keeps unrelated classes and skips falsy ones', () => {
  expect(cn('font-display font-bold', false, null, undefined, 'rounded-card text-warn-ink')).toBe('font-display font-bold rounded-card text-warn-ink');
  expect(cn('bg-surface dark:bg-surface-dark', 'bg-accent-soft dark:bg-accent-soft-dark')).toBe('bg-accent-soft dark:bg-accent-soft-dark');
});
