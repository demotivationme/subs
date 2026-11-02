import { create } from 'zustand';

import { configureApi } from '@/api/client';
import { clearQueryCache } from '@/api/queryClient';
import i18n from '@/i18n';
import { prefs } from '@/lib/prefs';

import { tokenStorage } from './tokenStorage';

type Status = 'loading' | 'signedOut' | 'signedIn';

type SessionState = {
  status: Status;
  token: string | null;
  hydrate: () => Promise<void>;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const useSession = create<SessionState>()((set, get) => ({
  status: 'loading',
  token: null,

  async hydrate() {
    const token = await tokenStorage.get();
    set(token ? { token, status: 'signedIn' } : { token: null, status: 'signedOut' });
  },

  async signIn(token) {
    await tokenStorage.set(token);
    set({ token, status: 'signedIn' });
  },

  async signOut() {
    if (get().status === 'signedOut') return;
    set({ token: null, status: 'signedOut' });
    await Promise.all([tokenStorage.clear(), clearQueryCache(), prefs.clear()]);
  },
}));

configureApi({
  getToken: () => useSession.getState().token,
  onUnauthorized: () => void useSession.getState().signOut(),
  getLocale: () => i18n.language,
});
