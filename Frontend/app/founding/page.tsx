'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '../../lib/useAuth'
import { API_URL, useAuthFetch } from '../../hooks/useAuthFetch'
import { useSubscription } from '../../hooks/useSubscription'
import { Sparkles, Check } from 'lucide-react'

function FoundingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const { fetchWithAuth } = useAuthFetch()
  const { isPro, isFoundingMember, loading: subLoading } = useSubscription()
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkoutResult = searchParams.get('checkout')

  if (authLoading || subLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-[#FFFBEB] to-[#FEF3C7]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
      </main>
    )
  }

  if (!user) {
    router.replace('/login')
    return null
  }

  const handleCheckout = async () => {
    setError(null)
    setCheckoutLoading(true)
    try {
      const res = await fetchWithAuth(`${API_URL}/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'founding' }),
      })
      if (res.ok) {
        const data = await res.json()
        window.location.href = data.checkout_url
      } else {
        const data = await res.json().catch(() => null)
        setError(data?.detail || 'Checkout failed. Please try again.')
      }
    } catch (err) {
      console.error('Founding checkout error:', err)
      setError('Checkout failed. Please try again.')
    } finally {
      setCheckoutLoading(false)
    }
  }

  return (
    <main className="min-h-screen px-4 pb-16 pt-8 bg-gradient-to-br from-white via-[#FFFBEB] to-[#FEF3C7]">
      <div className="mx-auto max-w-2xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-1.5 text-sm font-semibold text-amber-700 mb-4">
            <Sparkles size={16} />
            Founding Member
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
            Everything you need is free. Forever.
          </h1>
          <p className="mt-3 text-slate-500 max-w-lg mx-auto">
            Unlimited courses, syllabus parsing, Canvas + iCal sync, and a full deadline
            calendar — that&apos;s the free plan, and it isn&apos;t going anywhere. If you want
            to uncap the AI side and help support a student-built app, $15 once does that
            permanently. Not a subscription. No renewal, ever.
          </p>
        </div>

        {checkoutResult === 'success' && (
          <div className="mb-8 rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
            <h3 className="text-lg font-semibold text-green-800">Welcome to the founding crew!</h3>
            <p className="mt-1 text-sm text-green-600">
              Your unlimited AI access is live — thanks for backing ClassMate early.
            </p>
          </div>
        )}
        {checkoutResult === 'canceled' && (
          <div className="mb-8 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-600">
            Checkout canceled — no charge was made.
          </div>
        )}

        {isFoundingMember ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center mb-8">
            <h3 className="text-lg font-semibold text-amber-800">You&apos;re already a founding member!</h3>
            <p className="mt-1 text-sm text-amber-700">
              You have unlimited, permanent access to all Pro features.
            </p>
            <button
              onClick={() => router.push('/settings')}
              className="mt-4 rounded-full border border-amber-300 px-5 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
            >
              View account
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-amber-300 bg-white p-8 shadow-sm mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Founding Member</h3>
                <p className="mt-1 text-sm text-slate-500">One payment. Unlimited AI, forever.</p>
              </div>
              <div className="text-right">
                <span className="text-3xl font-bold text-slate-900">$15</span>
                <p className="text-xs text-slate-400">one time</p>
              </div>
            </div>
            <ul className="mt-6 space-y-2">
              {['Unlimited AI generations (flashcards, quizzes, summaries)', 'Unlimited AI chat', 'A permanent, non-renewing purchase — not a subscription', 'Supports a student-built app'].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
                  <Check size={16} className="text-amber-500 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            {isPro && (
              <p className="mt-4 text-xs text-slate-400">
                You already have Pro through a subscription. Buying founding member access
                makes it permanent — you can cancel your subscription afterward from Settings.
              </p>
            )}
            {error && (
              <p className="mt-4 text-sm text-red-600">{error}</p>
            )}
            <button
              onClick={handleCheckout}
              disabled={checkoutLoading}
              className="mt-6 w-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50"
            >
              {checkoutLoading ? 'Loading...' : 'Become a Founding Member — $15 once'}
            </button>
          </div>
        )}

        <p className="text-center text-xs text-slate-400">
          Prefer monthly or yearly billing instead?{' '}
          <button onClick={() => router.push('/upgrade')} className="underline hover:text-slate-600">
            See subscription pricing
          </button>
        </p>
      </div>
    </main>
  )
}

export default function FoundingPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center text-sm text-slate-500">
        Loading...
      </div>
    }>
      <FoundingContent />
    </Suspense>
  )
}
