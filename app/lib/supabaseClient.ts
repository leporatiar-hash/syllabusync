import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Placeholder for build time - will be replaced at runtime
const PLACEHOLDER_URL = 'https://placeholder.supabase.co'
const PLACEHOLDER_KEY = 'placeholder-key'

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase env vars missing: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

// Use createBrowserClient from @supabase/ssr for proper cookie-based auth in Next.js
// Using implicit flow to support cross-device magic link authentication
export const supabase = createBrowserClient(
  supabaseUrl || PLACEHOLDER_URL,
  supabaseAnonKey || PLACEHOLDER_KEY,
  {
    auth: {
      flowType: 'implicit',
      detectSessionInUrl: true,
      autoRefreshToken: true,
      persistSession: true,
    },
  }
)
