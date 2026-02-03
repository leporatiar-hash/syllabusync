import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// Lazy singleton — createBrowserClient is only called on first access, which
// always happens inside a useEffect / event handler (i.e. in the browser).
// This avoids the throw that occurs when Next.js pre-renders pages server-side
// and process.env.NEXT_PUBLIC_* is undefined during the build.
let _client: SupabaseClient | null = null

function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    _client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
