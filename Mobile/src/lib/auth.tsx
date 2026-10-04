import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, publicPost, setSessionExpiredHandler } from './api';
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
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [justSignedUp, setJustSignedUp] = useState(false);

  const loadMe = useCallback(async () => {
    const data = await api<Me>('/me');
    setMe(data);
    identifyPurchaser(data.user_id);
    registerForPush(false); // refresh token/timezone if already allowed; never prompts here
  }, []);

  const signOut = useCallback(async () => {
    await unregisterPush();
    await clearTokens();
    await resetPurchaser();
    setMe(null);
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => setMe(null));
    (async () => {
      try {
        const { access } = await loadTokens();
        if (access) await loadMe();
      } catch {
        // Offline or token rejected: show login rather than hanging on the splash screen.
        setMe(null);
      } finally {
        setReady(true);
      }
    })();
    return () => setSessionExpiredHandler(null);
  }, [loadMe]);

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
    },
    [loadMe],
  );

  const clearJustSignedUp = useCallback(() => setJustSignedUp(false), []);

  const value = useMemo(
    () => ({ ready, me, justSignedUp, clearJustSignedUp, signIn, signUp, signOut, refreshMe: loadMe }),
    [ready, me, justSignedUp, clearJustSignedUp, signIn, signUp, signOut, loadMe],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
