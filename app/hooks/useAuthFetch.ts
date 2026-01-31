import { supabase } from '../lib/supabaseClient'
import { API_BASE_URL } from '../lib/config'

const API_URL = API_BASE_URL || 'http://localhost:8000'

export { API_URL }

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers)
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  if (!token) {
    console.error('[authFetch] No session token available. User is not authenticated.')
    throw new Error('Not authenticated')
  }

  headers.set('Authorization', `Bearer ${token}`)

  return fetch(url, { ...options, headers })
}
