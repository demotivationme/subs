const KEY = 'subs.token';

/** localStorage can be unavailable (private mode, blocked storage): treat that as signed out. */
export const tokenStorage = {
  async get(): Promise<string | null> {
    try {
      return window.localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  async set(token: string): Promise<void> {
    try {
      window.localStorage.setItem(KEY, token);
    } catch {
      // The session still works for this tab.
    }
  },
  async clear(): Promise<void> {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      // Nothing stored.
    }
  },
};
