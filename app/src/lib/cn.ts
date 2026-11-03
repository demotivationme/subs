import { twMerge } from 'tailwind-merge';

/**
 * Joins NativeWind class names, skipping falsy ones. Later classes replace earlier ones of the
 * same kind (size, colour, font…), so a component's className overrides its variant: without the
 * merge both survive and the stylesheet's order picks the winner, e.g. `text-base` beat `text-[44px]`.
 */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return twMerge(classes.filter(Boolean).join(' '));
}
