import type { TFunction } from 'i18next';

import type { Period } from '@/api/types';

/** "monthly", "every 3 months", … */
export function periodLabel(t: TFunction, period: Period, intervalCount: number): string {
  return t(`period.${period}`, { count: intervalCount });
}
