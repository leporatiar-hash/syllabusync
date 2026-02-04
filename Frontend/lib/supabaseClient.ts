import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Custom storage that ONLY uses localStorage - never cookies.
// This prevents REQUEST_HEADER_TOO_LARGE errors on Vercel.
const localStorageAdapter = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(key)
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') return
    localStorage.setItem(key, value)
  },
  removeItem: (key: string): void => {
    if (typeof window === 'undefined') return
    localStorage.removeItem(key)
  },
}

// Lazy singleton — createClient is only called on first access, which
// always happens inside a useEffect / event handler (i.e. in the browser).
// This avoids the throw that occurs when Next.js pre-renders pages server-side
// and process.env.NEXT_PUBLIC_* is undefined during the build.
let _client: SupabaseClient | null = null

function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          storage: localStorageAdapter,
          storageKey: 'supabase-auth',
          flowType: 'pkce',
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      }
    )
  }
  return _client
}

// Proxy so that every existing `supabase.auth.*` / `supabase.from(...)` call
// works unchanged — the real client is only instantiated on first use.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getSupabaseClient(), prop, receiver)
  },
})
