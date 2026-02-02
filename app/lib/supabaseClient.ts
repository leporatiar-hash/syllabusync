import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Placeholder for build time - will be replaced at runtime
const PLACEHOLDER_URL = 'https://placeholder.supabase.co'
const PLACEHOLDER_KEY = 'placeholder-key'

// Lazy-load the Supabase client to avoid SSR issues
// createBrowserClient should only run in the browser
let _supabase: SupabaseClient | null = null

function getSupabaseClient(): SupabaseClient {
  if (_supabase) {
    return _supabase
  }

  // Only create in browser environment
  if (typeof window === 'undefined') {
    console.warn('[Supabase] Attempted to create client during SSR - returning placeholder')
    // Return a minimal mock for SSR that won't crash
    // The real client will be created on the client side
    return {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signInWithPassword: async () => ({ data: { session: null, user: null }, error: null }),
        signOut: async () => ({ error: null }),
      },
    } as unknown as SupabaseClient
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase] Env vars missing: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  console.log('[Supabase] Creating browser client...')
  _supabase = createBrowserClient(
    supabaseUrl || PLACEHOLDER_URL,
    supabaseAnonKey || PLACEHOLDER_KEY
  )

  return _supabase
}

// Export a proxy that lazily initializes the client
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const client = getSupabaseClient()
    const value = client[prop as keyof SupabaseClient]
    if (typeof value === 'function') {
      return value.bind(client)
    }
    return value
  },
})
