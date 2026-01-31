import { useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/useAuth'
import { API_BASE_URL } from '../lib/config'

const API_URL = API_BASE_URL || 'http://localhost:8000'

export { API_URL }

/**
 * Standalone authFetch - gets session directly from Supabase at call time
 */
export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Always get fresh session at call time
  const { data, error } = await supabase.auth.getSession()

  if (error) {
    console.error('[authFetch] Error getting session:', error)
    throw new Error('Failed to get session')
  }

  const token = data.session?.access_token

  if (!token) {
    console.error('[authFetch] No session token available')
    throw new Error('Not authenticated')
  }

  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${token}`)

  return fetch(url, { ...options, headers })
}

/**
 * Hook that returns an authenticated fetch function
 * The function gets fresh session from Supabase at each call
 */
export function useAuthFetch() {
  const { session } = useAuth()

  // fetchWithAuth gets the session fresh at each call
  const fetchWithAuth = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      // Get fresh session from Supabase at call time
      const { data, error } = await supabase.auth.getSession()

      if (error) {
        console.error('[fetchWithAuth] Error getting session:', error)
        throw new Error('Failed to get session')
      }

      const token = data.session?.access_token

      if (!token) {
        console.error('[fetchWithAuth] No session token. Session data:', data)
        throw new Error('Not authenticated')
      }

      const headers = new Headers(options.headers)
      headers.set('Authorization', `Bearer ${token}`)

      return fetch(url, { ...options, headers })
    },
    []
  )

  return { fetchWithAuth, token: session?.access_token }
}
