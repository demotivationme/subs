import { File } from 'expo-file-system';

/**
 * SDK 58's global fetch (expo/fetch) can't send React Native's `{ uri, name, type }` FormData
 * parts, so the picked image goes as an expo-file-system File, which it reads with bytes().
 */
export async function logoPart(uri: string): Promise<[Blob, string]> {
  const file = new File(uri);
  return [file as unknown as Blob, file.name];
}
