import { colorScheme, useColorScheme as useNativeWindScheme } from 'nativewind';
import { create } from 'zustand';

import { prefs } from '@/lib/prefs';

import { followSystem } from './followSystem';

export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

const isPreference = (value: string | null): value is ThemePreference => THEME_PREFERENCES.includes(value as ThemePreference);

function apply(preference: ThemePreference) {
  colorScheme.set(preference);
  followSystem(preference === 'system');
}

type ThemeState = {
  preference: ThemePreference;
  loaded: boolean;
  hydrate: () => Promise<void>;
  choose: (preference: ThemePreference) => Promise<void>;
};

/** The device's light/dark choice. Stored per device, so it survives signing out. */
export const useTheme = create<ThemeState>()((set) => ({
  preference: 'system',
  loaded: false,

  async hydrate() {
    let stored: string | null = null;
    try {
      stored = await prefs.get('theme');
    } catch {
      // Unreadable storage falls back to the system theme rather than holding the splash screen.
    }
    const preference = isPreference(stored) ? stored : 'system';
    apply(preference);
    set({ preference, loaded: true });
  },

  async choose(preference) {
    apply(preference);
    set({ preference });
    await prefs.set('theme', preference).catch(() => undefined);
  },
}));

/** The scheme on screen, honouring the user's choice. Use it instead of React Native's useColorScheme. */
export function useScheme(): 'light' | 'dark' {
  return useNativeWindScheme().colorScheme === 'dark' ? 'dark' : 'light';
}
