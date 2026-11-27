import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { identify, resetAnalytics, track } from './analytics';
import { api, ApiError, publicPost, setSessionExpiredHandler } from './api';
import { registerForPush, unregisterPush } from './notifications';
import { identifyPurchaser, resetPurchaser } from './purchases';
import { clearTokens, loadTokens, saveTokens } from './tokens';
import type { Me } from './types';

type TokenResponse = { access_token: string; refresh_token: string };

type AuthState = {
  ready: boolean;
  me: Me | null;
  /** True right after creating an account, until the post-signup paywall has been shown. */
  justSignedUp: boolean;
  clearJustSignedUp: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, referralSource?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
  /** A saved login exists but the server couldn't be reached at launch. */
  unreachable: boolean;
  retryRestore: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [justSignedUp, setJustSignedUp] = useState(false);
  const [unreachable, setUnreachable] = useState(false);

  const loadMe = useCallback(async () => {
    const data = await api<Me>('/me');
    setMe(data);
    identify(data.user_id, data.profile?.email);
    identifyPurchaser(data.user_id);
    registerForPush(false); // refresh token/timezone if already allowed; never prompts here
    // LMS due dates are shown in this timezone, so a Central/Pacific student's 11:59 PM stays on the right day.
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) api('/me/timezone', { method: 'POST', body: JSON.stringify({ timezone: tz }) }).catch(() => {});
  }, []);

  const signOut = useCallback(async () => {
    await unregisterPush();
    await clearTokens();
    await resetPurchaser();
    resetAnalytics();
    setMe(null);
  }, []);

  // Restores the saved session on launch. Only an explicit "session over" from the server, or no
  // saved login at all, shows the login screen. A locked Keychain (iOS launched us in the background)
  // or a network failure keeps the session and retries when the app comes to the foreground.
  const restore = useCallback(async () => {
    let tokens: { access: string | null; refresh: string | null };
    try {
      tokens = await loadTokens();
    } catch {
      return; // Keychain not readable yet (device locked). Stay on the splash; retry on foreground.
    }
    if (!tokens.access && !tokens.refresh) {
      setUnreachable(false);
      setReady(true);
      return;
    }
    try {
      await loadMe();
      setUnreachable(false);
      // Re-save so logins stored by older builds move to the background-readable Keychain class.
      if (tokens.access && tokens.refresh) saveTokens(tokens.access, tokens.refresh).catch(() => {});
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setMe(null);
      else setUnreachable(true); // offline / server error: don't throw the login away
    } finally {
      setReady(true);
    }
  }, [loadMe]);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUnreachable(false);
      setMe(null);
    });
    // restore() only sets state after awaiting the Keychain, never synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    restore();
    return () => setSessionExpiredHandler(null);
  }, [restore]);

  // Retry a launch that couldn't finish (locked Keychain or no network) when the app is opened.
  useEffect(() => {
    if (me) return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && (!ready || unreachable)) restore();
    });
    return () => sub.remove();
  }, [me, ready, unreachable, restore]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const t = await publicPost<TokenResponse>('/auth/login', { email: email.trim(), password });
      await saveTokens(t.access_token, t.refresh_token);
      await loadMe();
    },
    [loadMe],
  );

  const signUp = useCallback(
    async (email: string, password: string, referralSource?: string) => {
      const t = await publicPost<TokenResponse>('/auth/register', {
        email: email.trim(),
        password,
        referral_source: referralSource || null,
      });
      await saveTokens(t.access_token, t.refresh_token);
      setJustSignedUp(true);
      await loadMe();
      track('signup', { referral_source: referralSource ?? null });
    },
    [loadMe],
  );

  const clearJustSignedUp = useCallback(() => setJustSignedUp(false), []);

  const value = useMemo(
    () => ({ ready, me, justSignedUp, clearJustSignedUp, signIn, signUp, signOut, refreshMe: loadMe, unreachable, retryRestore: restore }),
    [ready, me, justSignedUp, clearJustSignedUp, signIn, signUp, signOut, loadMe, unreachable, restore],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
