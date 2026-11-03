const DARK_CLASS = 'dark';
const DARK_QUERY = '(prefers-color-scheme: dark)';

let query: MediaQueryList | undefined;

const sync = () => document.documentElement.classList.toggle(DARK_CLASS, query?.matches ?? false);

/**
 * With Tailwind's class-based dark mode, "system" means keeping the `dark` class in step with the
 * browser's setting ourselves; NativeWind only adds or removes it for an explicit light or dark.
 */
export function followSystem(on: boolean): void {
  if (typeof window === 'undefined' || !window.matchMedia) return;
  query ??= window.matchMedia(DARK_QUERY);
  query.removeEventListener('change', sync);
  if (!on) return;
  sync();
  query.addEventListener('change', sync);
}
