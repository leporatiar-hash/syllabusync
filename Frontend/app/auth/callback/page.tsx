'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../../lib/supabaseClient'

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) {
      router.replace('/login?error=Missing%20auth%20code')
      return
    }

    supabase.auth.exchangeCodeForSession(code)
      .then(({ error: exchangeError }) => {
        if (exchangeError) {
          setError(exchangeError.message)
          return
        }
        router.replace('/home')
      })
      .catch(() => {
        setError('Unable to complete authentication. Please try again.')
      })
  }, [searchParams, router])

  if (error) {
    return (
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">Login failed</h1>
          <p className="mt-2 text-sm text-slate-500">{error}</p>
          <Link href="/login" className="mt-4 inline-block text-sm text-[#5B8DEF] hover:underline">
            Back to login
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <div className="text-sm text-slate-500">Signing you in...</div>
    </main>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <div className="text-sm text-slate-500">Loading...</div>
      </main>
    }>
      <AuthCallbackContent />
    </Suspense>
  )
}
