import { useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/useAuth'
import { API_BASE_URL } from '../lib/config'

const API_URL = API_BASE_URL || 'http://localhost:8000'

export { API_URL }

/**
 * Standalone authFetch - gets session directly from Supabase at call time
 * Returns a mock 401 response instead of throwing when not authenticated
 */
export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  try {
    // Always get fresh session at call time
    const { data, error } = await supabase.auth.getSession()

    if (error) {
      console.error('[authFetch] Error getting session:', error)
      // Return a mock 401 response instead of throwing
      return new Response(JSON.stringify({ detail: 'Session error' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const token = data.session?.access_token

    if (!token) {
      console.log('[authFetch] No session token available - returning 401')
      // Return a mock 401 response instead of throwing
      return new Response(JSON.stringify({ detail: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const headers = new Headers(options.headers)
    headers.set('Authorization', `Bearer ${token}`)

    return fetch(url, { ...options, headers })
  } catch (err) {
    console.error('[authFetch] Unexpected error:', err)
    // Return a mock error response instead of throwing
    return new Response(JSON.stringify({ detail: 'Request failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Hook that returns an authenticated fetch function
 * The function gets fresh session from Supabase at each call
 * Returns mock 401 responses instead of throwing to prevent crashes
 */
export function useAuthFetch() {
  const { session } = useAuth()

  // fetchWithAuth gets the session fresh at each call
  const fetchWithAuth = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      try {
        // Get fresh session from Supabase at call time
        const { data, error } = await supabase.auth.getSession()

        if (error) {
          console.error('[fetchWithAuth] Error getting session:', error)
          return new Response(JSON.stringify({ detail: 'Session error' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          })
        }

        const token = data.session?.access_token

        if (!token) {
          console.log('[fetchWithAuth] No session token - returning 401')
          return new Response(JSON.stringify({ detail: 'Not authenticated' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          })
        }

        const headers = new Headers(options.headers)
        headers.set('Authorization', `Bearer ${token}`)

        return fetch(url, { ...options, headers })
      } catch (err) {
        console.error('[fetchWithAuth] Unexpected error:', err)
        return new Response(JSON.stringify({ detail: 'Request failed' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    },
    []
  )

  return { fetchWithAuth, token: session?.access_token }
}
