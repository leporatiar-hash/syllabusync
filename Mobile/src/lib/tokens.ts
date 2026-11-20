import * as SecureStore from 'expo-secure-store';

// Tokens live in the iOS Keychain (SecureStore), not AsyncStorage.
const ACCESS = 'cm-access-token';
const REFRESH = 'cm-refresh-token';

// iOS can launch the app in the background before the user opens it (prewarming, push), sometimes
// while the phone is still locked. The default WHEN_UNLOCKED items can't be read then, and the read
// throws, which used to land users on the login screen. AFTER_FIRST_UNLOCK is readable any time after
// the first unlock since boot.
const OPTS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

let accessCache: string | null = null;

/** Reads both tokens. Throws if the Keychain can't be read right now (e.g. device locked). */
export async function loadTokens() {
  const [access, refresh] = await Promise.all([SecureStore.getItemAsync(ACCESS, OPTS), SecureStore.getItemAsync(REFRESH, OPTS)]);
  accessCache = access;
  return { access, refresh };
}

export function getAccessToken() {
  return accessCache;
}

export async function getRefreshToken() {
  return SecureStore.getItemAsync(REFRESH, OPTS);
}

async function put(key: string, value: string) {
  // Updating an existing item keeps its old accessibility class, so items saved by earlier builds
  // (WHEN_UNLOCKED) are deleted first and re-added as AFTER_FIRST_UNLOCK.
  await SecureStore.deleteItemAsync(key, OPTS).catch(() => {});
  await SecureStore.setItemAsync(key, value, OPTS);
}

export async function saveTokens(access: string, refresh: string) {
  accessCache = access;
  await Promise.all([put(ACCESS, access), put(REFRESH, refresh)]);
}

export async function clearTokens() {
  accessCache = null;
  await Promise.all([SecureStore.deleteItemAsync(ACCESS, OPTS), SecureStore.deleteItemAsync(REFRESH, OPTS)]);
}
