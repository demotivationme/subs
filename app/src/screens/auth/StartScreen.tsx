import { router } from 'expo-router';
import { useEffect } from 'react';

import { prefs } from '@/lib/prefs';

/** Signed-out entry point: first run goes to the intro, everyone else to log in. */
export default function StartScreen() {
  useEffect(() => {
    let active = true;
    prefs
      .get('onboarding.seen')
      .catch(() => null)
      .then((seen) => {
        if (active) router.replace(seen ? '/login' : '/welcome');
      });
    return () => {
      active = false;
    };
  }, []);

  return null;
}
