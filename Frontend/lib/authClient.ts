import { API_BASE_URL } from './config'

const API_URL = API_BASE_URL || 'http://localhost:8000'
const ACCESS_KEY = 'cm-access-token'
const REFRESH_KEY = 'cm-refresh-token'

export interface AuthUser {
  id: string
  email: string
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const [, payload] = token.split('.')
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return null
  }
}

export const authClient = {
  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(ACCESS_KEY)
  },

  getUser(): AuthUser | null {
    const token = this.getAccessToken()
    if (!token) return null
    const payload = decodeJwtPayload(token)
    if (!payload) return null
    // Check expiry
    if (payload.exp && typeof payload.exp === 'number' && payload.exp < Date.now() / 1000) {
      return null
    }
    const id = payload.sub as string
    const email = payload.email as string
    if (!id || !email) return null
    return { id, email }
  },

  setTokens(accessToken: string, refreshToken: string): void {
    if (typeof window === 'undefined') return
    localStorage.setItem(ACCESS_KEY, accessToken)
    localStorage.setItem(REFRESH_KEY, refreshToken)
  },

  clearTokens(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },

  async refreshAccessToken(): Promise<string | null> {
    const refreshToken = typeof window !== 'undefined' ? localStorage.getItem(REFRESH_KEY) : null
    if (!refreshToken) return null
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })
      if (!res.ok) {
        this.clearTokens()
        return null
      }
      const data = await res.json()
      this.setTokens(data.access_token, data.refresh_token)
      return data.access_token
    } catch {
      return null
    }
  },

  async login(email: string, password: string): Promise<{ user: AuthUser; error: null } | { user: null; error: string }> {
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) return { user: null, error: data.detail || 'Login failed' }
      this.setTokens(data.access_token, data.refresh_token)
      return { user: { id: data.user_id, email: data.email }, error: null }
    } catch {
      return { user: null, error: 'Network error — please try again' }
    }
  },

  async register(
    email: string,
    password: string,
    referralCode?: string,
  ): Promise<{ user: AuthUser; accessToken: string; error: null } | { user: null; accessToken: null; error: string }> {
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, referral_code: referralCode || null }),
      })
      const data = await res.json()
      if (!res.ok) return { user: null, accessToken: null, error: data.detail || 'Registration failed' }
      this.setTokens(data.access_token, data.refresh_token)
      return { user: { id: data.user_id, email: data.email }, accessToken: data.access_token, error: null }
    } catch {
      return { user: null, accessToken: null, error: 'Network error — please try again' }
    }
  },

  async forgotPassword(email: string): Promise<{ error: string | null }> {
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        const data = await res.json()
        return { error: data.detail || 'Request failed' }
      }
      return { error: null }
    } catch {
      return { error: 'Network error — please try again' }
    }
  },

  async resetPassword(token: string, newPassword: string): Promise<{ user: AuthUser | null; error: string | null }> {
    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: newPassword }),
      })
      const data = await res.json()
      if (!res.ok) return { user: null, error: data.detail || 'Reset failed' }
      this.setTokens(data.access_token, data.refresh_token)
      return { user: { id: data.user_id, email: data.email }, error: null }
    } catch {
      return { user: null, error: 'Network error — please try again' }
    }
  },

  signOut(): void {
    this.clearTokens()
  },
}
