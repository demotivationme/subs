import { focusManager, onlineManager } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { AppState } from 'react-native';

let started = false;

/** Native: refetch on foreground and pause queries while offline (web uses browser events). */
export function setupAppLifecycle(): void {
  if (started) return;
  started = true;

  onlineManager.setEventListener((setOnline) => {
    const subscription = Network.addNetworkStateListener((state) => setOnline(state.isConnected !== false));
    return () => subscription.remove();
  });

  AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));
}
