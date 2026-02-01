'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../../lib/supabaseClient'

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const finalize = async () => {
      // Check for error from server-side route handler
      const errorParam = searchParams.get('error')
      if (errorParam) {
        setStatus('error')
        setMessage(errorParam)
        return
      }

      // Handle hash-based auth (implicit flow fallback)
      if (typeof window !== 'undefined' && window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.slice(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (error) {
            setStatus('error')
            setMessage(error.message)
            return
          }
          window.history.replaceState({}, document.title, window.location.pathname)
        }
      }

      // Check if we have an active session
      const { data, error } = await supabase.auth.getSession()
      if (error) {
        setStatus('error')
        setMessage(error.message)
        return
      }

      if (data.session?.user) {
        router.replace('/courses')
        return
      }

      setStatus('error')
      setMessage('No active session found. Please try logging in again.')
    }

    finalize()
  }, [router, searchParams])

  if (status === 'loading') {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center text-sm text-slate-500">
        Logging you in...
      </div>
    )
  }

  // Check if this is a cross-device/PKCE error
  const isCrossDeviceError = message?.toLowerCase().includes('pkce') ||
    message?.toLowerCase().includes('code verifier')

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">
          {isCrossDeviceError ? 'Different device detected' : 'Login failed'}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {isCrossDeviceError
            ? 'This login link was opened on a different device than where you requested it. Please request a new magic link on this device.'
            : (message || 'Something went wrong. Please try again.')}
        </p>
        <button
          onClick={() => router.replace('/login')}
          className="mt-4 rounded-lg bg-[#5B8DEF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3b6ed6]"
        >
          {isCrossDeviceError ? 'Request new link' : 'Back to login'}
        </button>
      </div>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center text-sm text-slate-500">
        Logging you in...
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  )
}
