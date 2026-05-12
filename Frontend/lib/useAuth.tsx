'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import posthog from 'posthog-js'
import { authClient, type AuthUser } from './authClient'

interface AuthState {
  user: AuthUser | null
  loading: boolean
  signOut: () => void
  refreshUser: () => void
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(() => {
    const u = authClient.getUser()
    setUser(u)
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

  const value = useMemo(
    () => ({ user, loading, signOut, refreshUser }),
    [user, loading, signOut, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
