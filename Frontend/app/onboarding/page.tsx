'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Onboarding wizard has been removed. Setup now happens inside the app.
// Any lingering links to /onboarding are redirected to the dashboard.
export default function OnboardingPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/home')
  }, [router])

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
      <div className="text-sm text-slate-500">Redirecting...</div>
    </main>
  )
}
