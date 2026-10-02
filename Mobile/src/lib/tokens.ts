import * as SecureStore from 'expo-secure-store';

// Tokens live in the iOS Keychain (SecureStore), not AsyncStorage.
const ACCESS = 'cm-access-token';
const REFRESH = 'cm-refresh-token';

let accessCache: string | null = null;

export async function loadTokens() {
  const [access, refresh] = await Promise.all([SecureStore.getItemAsync(ACCESS), SecureStore.getItemAsync(REFRESH)]);
  accessCache = access;
  return { access, refresh };
}

export function getAccessToken() {
  return accessCache;
}

export async function getRefreshToken() {
  return SecureStore.getItemAsync(REFRESH);
}

export async function saveTokens(access: string, refresh: string) {
  accessCache = access;
  await Promise.all([SecureStore.setItemAsync(ACCESS, access), SecureStore.setItemAsync(REFRESH, refresh)]);
}

export async function clearTokens() {
  accessCache = null;
  await Promise.all([SecureStore.deleteItemAsync(ACCESS), SecureStore.deleteItemAsync(REFRESH)]);
}
