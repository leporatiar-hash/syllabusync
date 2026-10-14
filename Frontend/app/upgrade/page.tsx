'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import posthog from 'posthog-js'
import { useAuth } from '../../lib/useAuth'
import { API_URL, useAuthFetch } from '../../hooks/useAuthFetch'
import { useSubscription } from '../../hooks/useSubscription'
import { Sparkles, Check } from 'lucide-react'
import { PRICING, promoEndLabel } from '../../lib/pricing'

export default function UpgradePage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { fetchWithAuth } = useAuthFetch()
  const { isPro, promoUntil, loading: subLoading } = useSubscription()
  // During the free-Pro promo everyone is Pro, but nobody has paid: show the plans for later.
  const onPromo = !!promoUntil
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)

  useEffect(() => {
    posthog.capture('pricing_page_viewed', { page: 'upgrade' })
  }, [])

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

  const handleCheckout = async (plan: 'monthly' | 'semester') => {
    posthog.capture('upgrade_clicked', { plan })
    setCheckoutLoading(plan)
    try {
      const res = await fetchWithAuth(`${API_URL}/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      if (res.ok) {
        const data = await res.json()
        posthog.capture('checkout_started', { plan })
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

  // Reminders mirror _build_user_reminders in Backend/main.py; they're push notifications, so they
  // arrive through the iPhone app. Study-tool limits mirror FREE_AI_GENERATION_LIMIT / chat limits.
  const features = [
    { label: 'Courses, calendar & LMS sync', free: 'Full access', pro: 'Full access' },
    { label: 'Reminder the night before', free: 'Included', pro: 'Included' },
    { label: 'Alert when a professor changes a due date', free: '—', pro: 'Included' },
    { label: '3-day and exam-week heads-ups', free: '—', pro: 'Included' },
    { label: 'Sunday game plan', free: '—', pro: 'Included' },
    { label: 'Flashcards, quizzes & summaries', free: '50/month', pro: 'Unlimited' },
    { label: 'Course chat', free: '20 msgs/week', pro: '50 msgs/week' },
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
            Never get caught off guard
          </h1>
          <p className="mt-3 text-slate-500 max-w-md mx-auto">
            Pro watches your LMS for you: you hear when a due date moves, get a heads-up days before
            things are due, and start every week with a plan.
          </p>
        </div>

        {/* Free Pro for everyone right now */}
        {onPromo && (
          <div className="rounded-2xl border border-[#C7D2FE] bg-[#EEF2FF] p-6 text-center mb-8">
            <h3 className="text-lg font-semibold text-slate-900">
              Pro is free for everyone through {promoEndLabel(promoUntil)}
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              You already have every Pro feature. No card needed. After {promoEndLabel(promoUntil)}, keep it with a plan below.
            </p>
          </div>
        )}

        {/* Already pro */}
        {isPro && !onPromo && (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center mb-8">
            <h3 className="text-lg font-semibold text-green-800">
              You&apos;re already on Pro!
            </h3>
            <p className="mt-1 text-sm text-green-600">
              You have unlimited access to all features.
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
        {(!isPro || onPromo) && (
          <div className="grid gap-4 md:grid-cols-2 mb-10">
            {/* Monthly */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Monthly</h3>
              <p className="mt-1 text-sm text-slate-500">Flexibility to cancel anytime</p>
              <div className="mt-4">
                <span className="text-3xl font-bold text-slate-900">{PRICING.monthly.label}</span>
                <span className="text-slate-400 text-sm">{PRICING.monthly.per}</span>
              </div>
              <button
                onClick={() => handleCheckout('monthly')}
                disabled={!!checkoutLoading}
                className="mt-6 w-full rounded-full border-2 border-[#5B8DEF] px-5 py-2.5 text-sm font-semibold text-[#5B8DEF] transition-all hover:bg-[#5B8DEF] hover:text-white disabled:opacity-50"
              >
                {checkoutLoading === 'monthly' ? 'Loading...' : 'Upgrade to Pro'}
              </button>
              <p className="mt-2 text-center text-xs text-slate-400">Renews monthly at {PRICING.monthly.label}. Cancel anytime.</p>
            </div>

            {/* Semester Pass */}
            <div className="relative rounded-2xl border-2 border-[#5B8DEF] bg-white p-6 shadow-sm">
              {PRICING.semester.amount < PRICING.monthly.amount * 6 - 0.5 && (
                <div className="absolute -top-3 right-4 rounded-full bg-[#5B8DEF] px-3 py-0.5 text-xs font-bold text-white">
                  Save {Math.round((1 - PRICING.semester.amount / (PRICING.monthly.amount * 6)) * 100)}%
                </div>
              )}
              <h3 className="text-lg font-semibold text-slate-900">{PRICING.semester.name}</h3>
              <p className="mt-1 text-sm text-slate-500">Covers a full semester</p>
              <div className="mt-4">
                <span className="text-3xl font-bold text-slate-900">{PRICING.semester.label}</span>
                <span className="text-slate-400 text-sm"> {PRICING.semester.per}</span>
              </div>
              <button
                onClick={() => handleCheckout('semester')}
                disabled={!!checkoutLoading}
                className="mt-5 w-full rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50"
              >
                {checkoutLoading === 'semester' ? 'Loading...' : `Get the ${PRICING.semester.name}`}
              </button>
              <p className="mt-2 text-center text-xs text-slate-400">Renews every 6 months at {PRICING.semester.label}. Cancel anytime.</p>
            </div>
          </div>
        )}

        {(!isPro || onPromo) && (
          <div className="mb-10 space-y-1 text-center text-sm text-slate-500">
            <p><span className="font-medium text-slate-700">Not happy?</span> Full refund within 14 days, no questions asked. Cancel anytime in Settings.</p>
            <p>May be paid with 529 college savings (educational software used by the student). Check with your plan.</p>
            <p>Can&apos;t afford it right now? Email <a href="mailto:hello@tryclassmate.com" className="font-medium text-[#5B8DEF]">hello@tryclassmate.com</a>. We&apos;d rather you have it.</p>
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
                  {f.pro === 'Unlimited' || f.pro === 'Included' ? (
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
          <p className="mt-4 text-xs text-slate-400">Reminders and alerts are push notifications in the ClassMate iPhone app.</p>
        </div>

      </div>
    </main>
  )
}
