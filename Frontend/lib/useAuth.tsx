'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    let listenerUnsubscribe: (() => void) | null = null

    // Initialize auth with comprehensive error handling
    const initAuth = async () => {
      try {
        console.log('[Auth] Initializing session...')
        const { data, error } = await supabase.auth.getSession()

        if (!isMounted) return

        if (error) {
          console.error('[Auth] Session load failed:', error.message)
          // Don't crash - continue with null session
        } else {
          console.log('[Auth] Session loaded:', {
            hasSession: !!data.session,
            userId: data.session?.user?.id?.slice(0, 8) || null,
          })
        }

        setSession(data.session || null)
        setUser(data.session?.user || null)
      } catch (err) {
        console.error('[Auth] Unexpected error during session init:', err)
        // Don't crash - just set to logged out state
        setSession(null)
        setUser(null)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    initAuth()

    // Set up auth state listener with error handling
    try {
      const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
        if (!isMounted) return

        console.log('[Auth] State change:', _event, {
          hasSession: !!newSession,
          userId: newSession?.user?.id?.slice(0, 8) || null,
        })

        setSession(newSession)
        setUser(newSession?.user || null)
        setLoading(false)
      })
      listenerUnsubscribe = () => listener.subscription.unsubscribe()
    } catch (err) {
      console.error('[Auth] Failed to set up auth listener:', err)
    }

    return () => {
      isMounted = false
      if (listenerUnsubscribe) {
        try {
          listenerUnsubscribe()
        } catch (err) {
          console.error('[Auth] Failed to unsubscribe:', err)
        }
      }
    }
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const value = useMemo(() => ({ user, session, loading, signOut }), [user, session, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
