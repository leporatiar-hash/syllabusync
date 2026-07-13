'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../lib/useAuth'
import V2LandingPage from './v2/V2LandingPage'

export default function HomeGate() {
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    // If user is logged in, redirect to home dashboard
    if (!loading && user) {
      router.replace('/home')
    }
  }, [user, loading, router])

  // Covers the landing page while we check auth / redirect a logged-in
  // visitor away. The landing page itself always renders underneath —
  // there's no top-level branch that swaps which component tree mounts.
  const showOverlay = loading || !!user

  return (
    <div className="relative">
      <V2LandingPage />
      {showOverlay && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#5B8DEF] border-t-transparent" />
        </div>
      )}
    </div>
  )
}
