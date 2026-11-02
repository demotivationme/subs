import * as Device from 'expo-device';
import { Platform } from 'react-native';

/** Names the API token so a user can tell their sessions apart. */
export function deviceName(): string {
  return (Device.deviceName ?? Device.modelName ?? Platform.OS).slice(0, 100);
}
