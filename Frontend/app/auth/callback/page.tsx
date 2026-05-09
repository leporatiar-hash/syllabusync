'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// This route is no longer used — native JWT auth doesn't need a callback.
// Kept to handle any old bookmarked links gracefully.
export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/home')
  }, [router])

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <div className="text-sm text-slate-500">Signing you in...</div>
    </main>
  )
}
