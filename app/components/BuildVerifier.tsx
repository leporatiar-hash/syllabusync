'use client'

import { useEffect } from 'react'

// This timestamp is updated at build time
const BUILD_TIMESTAMP = '2026-01-31T13:15:00Z'
const BUILD_ID = '20260131-structure-fix'

export default function BuildVerifier() {
  useEffect(() => {
    console.log('=== CLASSMATE BUILD VERIFICATION ===')
    console.log('BUILD_ID:', BUILD_ID)
    console.log('BUILD_TIME:', BUILD_TIMESTAMP)
    console.log('SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 30) || 'NOT SET')
    console.log('ANON_KEY_EXISTS:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    console.log('====================================')
  }, [])

  return null
}
