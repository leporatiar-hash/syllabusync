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

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return
      if (error) {
        console.error('Supabase session load failed', error)
      } else {
        console.info('Supabase getSession()', {
          hasSession: !!data.session,
          userId: data.session?.user?.id || null,
        })
      }
      setSession(data.session || null)
      setUser(data.session?.user || null)
      setLoading(false)
      console.info('Auth provider: Supabase', { user: !!data.session?.user })
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      console.info('Supabase onAuthStateChange', {
        event: _event,
        hasSession: !!newSession,
        userId: newSession?.user?.id || null,
      })
      setSession(newSession)
      setUser(newSession?.user || null)
      setLoading(false)
      console.info('Auth provider: Supabase', { user: !!newSession?.user })
    })

    return () => {
      isMounted = false
      listener.subscription.unsubscribe()
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
