'use client'

import { useEffect } from 'react'

// This timestamp is updated at build time
const BUILD_TIMESTAMP = '2026-01-31T14:30:00Z'
const BUILD_ID = '20260131-ssr-auth-fix'

export default function BuildVerifier() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    console.log('=== CLASSMATE BUILD VERIFICATION ===')
    console.log('BUILD_ID:', BUILD_ID)
    console.log('BUILD_TIME:', BUILD_TIMESTAMP)
    console.log('SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 30) || 'NOT SET')
    console.log('ANON_KEY_EXISTS:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    console.log('====================================')
  }, [])

  return null
}
