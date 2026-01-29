'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { API_URL } from '../hooks/useAuthFetch'

interface UserProfile {
  email: string
  full_name: string | null
  school_name: string | null
  school_type: string | null
  academic_year: string | null
  major: string | null
  profile_picture: string | null
}

interface AuthState {
  token: string | null
  userId: string | null
  profile: UserProfile | null
  isLoading: boolean
  requestCode: (email: string) => Promise<void>
  verifyCode: (email: string, code: string) => Promise<void>
  logout: () => void
  updateProfile: (profile: Partial<UserProfile>) => void
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('auth')
    if (stored) {
      try {
        const data = JSON.parse(stored)
        setToken(data.token)
        setUserId(data.userId)
        setProfile(data.profile)
        if (data.token) {
          fetch(`${API_URL}/auth/session`, {
            headers: { Authorization: `Bearer ${data.token}` },
          })
            .then(async (res) => {
              if (res.status === 401) {
                throw new Error('Unauthorized')
              }
              if (!res.ok) {
                throw new Error('Session check failed')
              }
              const session = await res.json()
              if (session?.user?.id) {
                setUserId(session.user.id)
                localStorage.setItem('auth', JSON.stringify({
                  token: data.token,
                  userId: session.user.id,
                  profile: data.profile,
                }))
              }
            })
            .catch(() => {
              setToken(null)
              setUserId(null)
              setProfile(null)
              localStorage.removeItem('auth')
            })
            .finally(() => setIsLoading(false))
          return
        }
      } catch {
        localStorage.removeItem('auth')
      }
    }
    setIsLoading(false)
  }, [])

  const persistAuth = (t: string, uid: string, p: UserProfile) => {
    setToken(t)
    setUserId(uid)
    setProfile(p)
    localStorage.setItem('auth', JSON.stringify({ token: t, userId: uid, profile: p }))
  }

  const requestCode = async (email: string) => {
    const res = await fetch(`${API_URL}/auth/request-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.detail || 'Failed to send code')
    }
  }

  const verifyCode = async (email: string, code: string) => {
    const res = await fetch(`${API_URL}/auth/verify-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.detail || 'Invalid code')
    }
    const data = await res.json()
    persistAuth(data.access_token, data.user_id, data.profile)
  }

  const logout = () => {
    if (token) {
      fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {})
    }
    setToken(null)
    setUserId(null)
    setProfile(null)
    localStorage.removeItem('auth')
  }

  const updateProfile = (partial: Partial<UserProfile>) => {
    if (profile) {
      const updated = { ...profile, ...partial }
      setProfile(updated)
      if (token && userId) {
        localStorage.setItem('auth', JSON.stringify({ token, userId, profile: updated }))
      }
    }
  }

  return (
    <AuthContext.Provider value={{ token, userId, profile, isLoading, requestCode, verifyCode, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
