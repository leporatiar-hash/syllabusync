import { API_BASE_URL } from '../lib/config'

const API_URL = API_BASE_URL || 'http://localhost:8000'

export { API_URL }

export function authHeaders(): Record<string, string> {
  try {
    const stored = localStorage.getItem('auth')
    if (stored) {
      const { token, userId } = JSON.parse(stored)
      const headers: Record<string, string> = {}
      if (token) headers.Authorization = `Bearer ${token}`
      if (userId) headers['X-User-Id'] = userId
      if (Object.keys(headers).length > 0) return headers
    }
  } catch {}
  return {}
}

export function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers)
  const auth = authHeaders()
  if (auth.Authorization) headers.set('Authorization', auth.Authorization)
  if (auth['X-User-Id']) headers.set('X-User-Id', auth['X-User-Id'])
  return fetch(url, { ...options, headers }).then(res => {
    if (res.status === 401) {
      localStorage.removeItem('auth')
      window.location.href = '/login'
    }
    return res
  })
}
