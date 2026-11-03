import '../global.css';
import '@/i18n';

import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { setupAppLifecycle } from '@/api/lifecycle';
import { persistOptions, queryClient } from '@/api/queryClient';
import { useSession } from '@/auth/session';
import { useScheme, useTheme } from '@/theme';

void SplashScreen.preventAutoHideAsync();
setupAppLifecycle();

export default function RootLayout() {
  const scheme = useScheme();
  const status = useSession((s) => s.status);
  const themeLoaded = useTheme((s) => s.loaded);
  const [fontsLoaded, fontError] = useFonts({
    Manrope_700Bold,
    Manrope_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  // A font failure must not trap the app on the splash screen: fall back to system fonts.
  const ready = (fontsLoaded || fontError !== null) && status !== 'loading' && themeLoaded;

  useEffect(() => {
    void useSession.getState().hydrate();
    void useTheme.getState().hydrate();
  }, []);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  // Keep the splash screen up until the fonts are in, the theme is applied and we know whether a token is stored.
  if (!ready) return null;

  const signedIn = status === 'signedIn';

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={signedIn} redirectTo="/start">
            <Stack.Screen name="(app)" />
          </Stack.Protected>
          <Stack.Protected guard={!signedIn} redirectTo="/">
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
        </Stack>
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}
