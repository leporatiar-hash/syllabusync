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
 * Maps an opaque browser-level fetch failure to an actionable message. Safari throws
 * "Load failed" (and our own authFetch catch above returns "Request failed") when a request
 * never reaches the server at all — the most common cause is a File handle the browser can't
 * actually read from, e.g. dragging a file straight out of Safari's Downloads popover instead
 * of Finder/File Explorer, which hands over a reference with no readable backing data.
 */
export function friendlyUploadErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : ''
  if (
    message === 'Load failed' ||
    message === 'Request failed' ||
    message === 'Failed to fetch' ||
    message.includes('NetworkError')
  ) {
    return "Couldn't read that file. If you dragged it straight from your browser's download list, try dragging it from Finder (or File Explorer) instead, or click to browse for it."
  }
  return message || 'Upload failed.'
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
