import { Stack } from 'expo-router';

export default function AuthLayout() {
  // Screens draw their own headers (the Clear Ledger canvases have none).
  return <Stack screenOptions={{ headerShown: false }} />;
}
