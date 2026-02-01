'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../lib/useAuth'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  // Check for error from auth callback
  const errorParam = searchParams.get('error')
  const isCrossDeviceError = errorParam?.toLowerCase().includes('pkce') ||
    errorParam?.toLowerCase().includes('code verifier')

  useEffect(() => {
    if (!loading && user) {
      router.replace('/courses')
    }
  }, [loading, user, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    setSent(false)

    const origin = window.location.origin
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
      },
    })

    if (error) {
      alert(error.message)
    } else {
      setSent(true)
    }
    setSending(false)
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Log in</h1>
        <p className="mt-2 text-sm text-slate-500">
          Enter your email and we’ll send you a magic link.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition-colors focus:border-[#5B8DEF] focus:ring-2 focus:ring-[#5B8DEF]/20"
            placeholder="you@school.edu"
          />

          <button
            type="submit"
            disabled={sending}
            className="w-full rounded-lg bg-gradient-to-r from-[#5B8DEF] to-[#A78BFA] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {sending ? 'Sending...' : 'Send login link'}
          </button>
        </form>

        {sent && (
          <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
            Check your inbox for the login link.
          </div>
        )}

        {errorParam && (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            <p className="font-medium">
              {isCrossDeviceError ? 'Different device detected' : 'Login failed'}
            </p>
            <p className="mt-1">
              {isCrossDeviceError
                ? 'The login link was opened on a different device. Please request a new link below.'
                : errorParam}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center text-sm text-slate-500">
        Loading...
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
