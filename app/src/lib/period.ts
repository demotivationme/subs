import type { TFunction } from 'i18next';

import type { Period } from '@/api/types';

/** "monthly", "every 3 months", … */
export function periodLabel(t: TFunction, period: Period, intervalCount: number): string {
  return t(`period.${period}`, { count: intervalCount });
}

/** What one year of this billing cycle costs, in the same minor units (weeks count as 52 a year). */
export function yearlyAmount(amount: number, period: Period, intervalCount: number): number {
  const perYear = { week: 52, month: 12, year: 1 }[period];
  return Math.round((amount * perYear) / intervalCount);
}
