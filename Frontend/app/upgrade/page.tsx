'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../lib/useAuth'
import { API_URL, useAuthFetch } from '../../hooks/useAuthFetch'
import { useSubscription } from '../../hooks/useSubscription'
import { Sparkles, Check } from 'lucide-react'

export default function UpgradePage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { fetchWithAuth } = useAuthFetch()
  const { isPro, tier, loading: subLoading } = useSubscription()
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)

  if (authLoading || subLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-[#F8FAFF] to-[#EEF2FF]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#5B8DEF] border-t-transparent" />
      </main>
    )
  }

  if (!user) {
    router.replace('/login')
    return null
  }

  const handleCheckout = async (plan: 'monthly' | 'yearly') => {
    setCheckoutLoading(plan)
    try {
      const res = await fetchWithAuth(`${API_URL}/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      if (res.ok) {
        const data = await res.json()
        window.location.href = data.checkout_url
      } else {
        console.error('Checkout failed')
      }
    } catch (err) {
      console.error('Checkout error:', err)
    } finally {
      setCheckoutLoading(null)
    }
  }

  const features = [
    { label: 'Courses', free: 'Unlimited', pro: 'Unlimited' },
    { label: 'Calendar & Deadlines', free: 'Full access', pro: 'Full access' },
    { label: 'Canvas / iCal Sync', free: 'Full access', pro: 'Full access' },
    { label: 'AI Flashcards', free: '5/month', pro: 'Unlimited' },
    { label: 'AI Quizzes', free: '5/month', pro: 'Unlimited' },
    { label: 'AI Summaries', free: '5/month', pro: 'Unlimited' },
    { label: 'AI Course Chat', free: 'Not available', pro: '50 msgs/week' },
  ]

  return (
    <main className="min-h-screen px-4 pb-16 pt-8 bg-gradient-to-br from-white via-[#F8FAFF] to-[#EEF2FF]">
      <div className="mx-auto max-w-3xl">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#5B8DEF]/10 px-4 py-1.5 text-sm font-semibold text-[#5B8DEF] mb-4">
            <Sparkles size={16} />
            ClassMate Pro
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
            Unlock the full ClassMate experience
          </h1>
          <p className="mt-3 text-slate-500 max-w-md mx-auto">
            Unlimited AI-powered study tools. Flashcards, quizzes, and summaries with no limits.
          </p>
        </div>

        {/* Already pro */}
        {isPro && (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center mb-8">
            <h3 className="text-lg font-semibold text-green-800">
              {tier === 'grandfathered'
                ? "You're a Pro member (Early Supporter)"
                : "You're already on Pro!"}
            </h3>
            <p className="mt-1 text-sm text-green-600">
              {tier === 'grandfathered'
                ? 'You have unlimited access as an early user. Thank you for being here from the start!'
                : 'You have unlimited access to all features.'}
            </p>
            <button
              onClick={() => router.push('/settings')}
              className="mt-4 rounded-full border border-green-300 px-5 py-2 text-sm font-semibold text-green-700 hover:bg-green-100 transition-colors"
            >
              Manage Subscription
            </button>
          </div>
        )}

        {/* Pricing cards */}
        {!isPro && (
          <div className="grid gap-4 md:grid-cols-2 mb-10">
            {/* Monthly */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Monthly</h3>
              <p className="mt-1 text-sm text-slate-500">Flexibility to cancel anytime</p>
              <div className="mt-4">
                <span className="text-3xl font-bold text-slate-900">$4.99</span>
                <span className="text-slate-400 text-sm">/month</span>
              </div>
              <button
                onClick={() => handleCheckout('monthly')}
                disabled={!!checkoutLoading}
                className="mt-6 w-full rounded-full border-2 border-[#5B8DEF] px-5 py-2.5 text-sm font-semibold text-[#5B8DEF] transition-all hover:bg-[#5B8DEF] hover:text-white disabled:opacity-50"
              >
                {checkoutLoading === 'monthly' ? 'Loading...' : 'Start 10-Day Free Trial'}
              </button>
              <p className="mt-2 text-center text-xs text-slate-400">No charge for 10 days. Cancel anytime.</p>
            </div>

            {/* Yearly */}
            <div className="relative rounded-2xl border-2 border-[#5B8DEF] bg-white p-6 shadow-sm">
              <div className="absolute -top-3 right-4 rounded-full bg-[#5B8DEF] px-3 py-0.5 text-xs font-bold text-white">
                Save 33%
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Yearly</h3>
              <p className="mt-1 text-sm text-slate-500">Best value for the school year</p>
              <div className="mt-4">
                <span className="text-3xl font-bold text-slate-900">$39.99</span>
                <span className="text-slate-400 text-sm">/year</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">~$3.33/month</p>
              <button
                onClick={() => handleCheckout('yearly')}
                disabled={!!checkoutLoading}
                className="mt-5 w-full rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50"
              >
                {checkoutLoading === 'yearly' ? 'Loading...' : 'Start 10-Day Free Trial'}
              </button>
              <p className="mt-2 text-center text-xs text-slate-400">No charge for 10 days. Cancel anytime.</p>
            </div>
          </div>
        )}

        {/* Feature comparison */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400 mb-4">
            What you get
          </h3>
          <div className="divide-y divide-slate-100">
            <div className="grid grid-cols-3 gap-4 pb-3 text-xs font-semibold text-slate-500">
              <span>Feature</span>
              <span className="text-center">Free</span>
              <span className="text-center text-[#5B8DEF]">Pro</span>
            </div>
            {features.map((f) => (
              <div
                key={f.label}
                className="grid grid-cols-3 gap-4 py-3 text-sm"
              >
                <span className="font-medium text-slate-700">{f.label}</span>
                <span className="text-center text-slate-500">{f.free}</span>
                <span className="text-center font-semibold text-[#5B8DEF]">
                  {f.pro === 'Unlimited' ? (
                    <span className="inline-flex items-center gap-1">
                      <Check size={14} />
                      {f.pro}
                    </span>
                  ) : (
                    f.pro
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
