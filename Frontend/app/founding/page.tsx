'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Founding Member is no longer sold (Oct 2026). Existing founding members keep Pro until their
// grant ends (shown in Settings); old links land on the current plans.
export default function FoundingPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/upgrade')
  }, [router])
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
      <div className="text-sm text-slate-500">Redirecting...</div>
    </main>
  )
}
