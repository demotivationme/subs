import { Stack } from 'expo-router';

// Signed-out entry always goes through /start, which picks welcome or login.
export const unstable_settings = { initialRouteName: 'start' };

export default function AuthLayout() {
  // Screens draw their own headers (the Clear Ledger canvases have none).
  return <Stack screenOptions={{ headerShown: false }} />;
}
