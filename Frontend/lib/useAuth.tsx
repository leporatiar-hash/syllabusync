'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import posthog from 'posthog-js'
import { authClient, type AuthUser } from './authClient'

interface AuthState {
  user: AuthUser | null
  // Kept for compatibility with CrowWidget and useAuthFetch
  session: { access_token: string } | null
  loading: boolean
  signOut: () => void
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    const u = authClient.getUser()
    setUser(u)
    return u
  }, [])

  useEffect(() => {
    // Read user from the stored access token
    const u = authClient.getUser()
    if (u) {
      setUser(u)
      setLoading(false)
    } else {
      // Access token missing or expired — try silent refresh
      authClient.refreshAccessToken().then((newToken) => {
        if (newToken) {
          setUser(authClient.getUser())
        }
        setLoading(false)
      })
    }
  }, [])

  const signOut = useCallback(() => {
    posthog.capture('user_logged_out')
    authClient.signOut()
    setUser(null)
  }, [])

  const session = useMemo(
    () => (authClient.getAccessToken() ? { access_token: authClient.getAccessToken()! } : null),
    // Re-derive whenever user changes so CrowWidget always has a fresh token ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user],
  )

  const value = useMemo(
    () => ({ user, session, loading, signOut }),
    [user, session, loading, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
