import { useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/useAuth'
import { API_BASE_URL } from '../lib/config'

const API_URL = API_BASE_URL || 'http://localhost:8000'

export { API_URL }

/**
 * Legacy authFetch - tries to get session from Supabase client
 * May fail if cookies aren't accessible. Prefer useAuthFetch hook instead.
 */
export async function authFetch(
  url: string,
  options: RequestInit = {},
  providedToken?: string
): Promise<Response> {
  const headers = new Headers(options.headers)

  let token = providedToken

  // If no token provided, try to get it from Supabase
  if (!token) {
    const { data } = await supabase.auth.getSession()
    token = data.session?.access_token
  }

  if (!token) {
    console.error('[authFetch] No session token available. User is not authenticated.')
    throw new Error('Not authenticated')
  }

  headers.set('Authorization', `Bearer ${token}`)

  return fetch(url, { ...options, headers })
}

/**
 * Hook that returns an authenticated fetch function using the session from AuthContext
 */
export function useAuthFetch() {
  const { session } = useAuth()

  const fetchWithAuth = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      const token = session?.access_token

      if (!token) {
        console.error('[useAuthFetch] No session token available. User is not authenticated.')
        throw new Error('Not authenticated')
      }

      const headers = new Headers(options.headers)
      headers.set('Authorization', `Bearer ${token}`)

      return fetch(url, { ...options, headers })
    },
    [session]
  )

  return { fetchWithAuth, token: session?.access_token }
}
