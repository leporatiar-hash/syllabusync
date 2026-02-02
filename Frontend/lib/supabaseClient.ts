import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Placeholder for build time - will be replaced at runtime
const PLACEHOLDER_URL = 'https://placeholder.supabase.co'
const PLACEHOLDER_KEY = 'placeholder-key'

if (!supabaseUrl || !supabaseAnonKey) {
  // Only throw error at runtime in browser, not during build
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    console.error('CRITICAL: Supabase env vars missing: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  } else {
    console.warn('Supabase env vars missing: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY (using placeholders for build)')
  }
}

export const supabase = createClient(supabaseUrl || PLACEHOLDER_URL, supabaseAnonKey || PLACEHOLDER_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
})
