import { API_URL } from './config';
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from './tokens';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Called when refresh fails, so the auth provider can drop to the login screen.
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(fn: (() => void) | null) {
  onSessionExpired = fn;
}

/** 'ok' = new tokens saved; 'rejected' = the server said the session is over; 'error' = couldn't tell (offline, 5xx). */
type RefreshResult = 'ok' | 'rejected' | 'error';
let refreshing: Promise<RefreshResult> | null = null;

async function refreshTokens(): Promise<RefreshResult> {
  // Share one in-flight refresh across concurrent 401s.
  refreshing ??= (async (): Promise<RefreshResult> => {
    try {
      const refresh_token = await getRefreshToken();
      if (!refresh_token) return 'rejected';
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token }),
      });
      if (res.status === 401 || res.status === 403) return 'rejected';
      if (!res.ok) return 'error';
      const data = await res.json();
      await saveTokens(data.access_token, data.refresh_token);
      return 'ok';
    } catch {
      // Network failure or a locked Keychain: keep the saved login and try again later.
      return 'error';
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

export async function errorMessage(res: Response) {
  try {
    const data = await res.json();
    if (typeof data.detail === 'string') return data.detail;
    if (Array.isArray(data.detail)) return data.detail[0]?.msg ?? 'Request failed';
    if (typeof data.detail?.message === 'string') return data.detail.message; // limit_reached payloads
  } catch {}
  return `Request failed (${res.status})`;
}

/** Authenticated fetch against the ClassMate API. Retries once after refreshing an expired token. */
export async function apiRaw(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  // Also refresh when there's no access token in memory but a refresh token may be saved.
  if (res.status === 401 && retry) {
    const result = await refreshTokens();
    if (result === 'ok') return apiRaw(path, init, false);
    // Only sign out when the server rejected the session, never because of a network blip.
    if (result === 'rejected' && token) {
      await clearTokens();
      onSessionExpired?.();
    }
  }
  return res;
}

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiRaw(path, init);
  if (!res.ok) throw new ApiError(res.status, await errorMessage(res));
  if (res.status === 204) return undefined as T;
  return res.json();
}

/** Unauthenticated JSON POST (login/register/forgot-password). */
export async function publicPost<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    if (res.status === 429) throw new ApiError(429, 'Too many attempts. Please wait a minute and try again.');
    throw new ApiError(res.status, await errorMessage(res));
  }
  return res.json();
}
