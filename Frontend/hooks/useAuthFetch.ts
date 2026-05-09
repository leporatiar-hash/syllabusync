import { useCallback } from 'react'
import { authClient } from '../lib/authClient'
import { API_BASE_URL } from '../lib/config'

const API_URL = API_BASE_URL || 'http://localhost:8000'

export { API_URL }

async function getValidToken(): Promise<string | null> {
  let token = authClient.getAccessToken()
  if (!token || !authClient.getUser()) {
    // Token missing or expired — attempt silent refresh
    token = await authClient.refreshAccessToken()
  }
  return token
}

/**
 * Standalone authFetch — gets a valid JWT at call time, refreshing silently if needed.
 * Returns a mock 401 Response instead of throwing when not authenticated.
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  try {
    const token = await getValidToken()
    if (!token) {
      return new Response(JSON.stringify({ detail: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const headers = new Headers(options.headers)
    headers.set('Authorization', `Bearer ${token}`)
    return fetch(url, { ...options, headers })
  } catch {
    return new Response(JSON.stringify({ detail: 'Request failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

/**
 * Hook that returns an authenticated fetch function.
 */
export function useAuthFetch() {
  const fetchWithAuth = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      return authFetch(url, options)
    },
    [],
  )

  const token = authClient.getAccessToken()
  return { fetchWithAuth, token }
}
