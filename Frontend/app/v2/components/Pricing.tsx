'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import posthog from 'posthog-js'
import RevealOnScroll from './RevealOnScroll'
import { BRAND } from './tokens'
import { PRICING } from '../../../lib/pricing'

// Mirrors the tiers in Backend/main.py (_build_user_reminders, FREE_AI_GENERATION_LIMIT) and the
// upgrade page. Reminders and alerts are push notifications, delivered through the iPhone app.
const FREE = [
  'Every class and due date from your LMS',
  'Syllabus reading: policies, office hours, exams',
  'Calendar view',
  'A reminder the night before each deadline',
  '50 flashcard/quiz/summary generations a month',
]
const PRO = [
  'Everything in Free',
  'An alert when a professor changes a due date',
  'Heads-ups 3 days ahead and a week before exams',
  'A Sunday game plan for the week ahead',
  'Unlimited flashcards, quizzes and summaries',
]

function Tick({ color }: { color: string }) {
  return (
    <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

export default function Pricing() {
  const router = useRouter()

  useEffect(() => {
    posthog.capture('pricing_page_viewed', { page: 'landing' })
  }, [])

  return (
    <section id="pricing" className="py-24 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">Simple, honest pricing</h2>
          <p className="text-lg text-slate-500">The core is free. Pro is the insurance policy.</p>
        </div>

        <RevealOnScroll className="grid md:grid-cols-2 gap-6 items-start max-w-3xl mx-auto">
          {/* Free */}
          <div className="rounded-2xl border border-slate-200 p-8 flex flex-col gap-6 bg-white">
            <div>
              <p className="text-sm font-semibold text-slate-500 mb-1">Free</p>
              <p className="text-4xl font-bold text-slate-900">
                $0 <span className="text-base font-normal text-slate-400">/forever</span>
              </p>
            </div>
            <ul className="space-y-3 flex-1">
              {FREE.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <Tick color="#94A3B8" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => router.push('/signup')}
              className="w-full py-3 rounded-xl border-2 border-slate-200 text-sm font-semibold text-slate-700 hover:border-[#5B4EE8] hover:text-[#5B4EE8] transition-colors"
            >
              Get started free
            </button>
          </div>

          {/* Pro */}
          <div className="relative flex flex-col">
            <div className="flex justify-center mb-3">
              <span className="rounded-full px-4 py-1 text-xs font-bold text-white" style={{ background: BRAND }}>
                Never caught off guard
              </span>
            </div>
            <div className="rounded-2xl p-8 flex flex-col gap-6 bg-white" style={{ border: '2px solid #5B4EE8' }}>
              <div>
                <p className="text-sm font-semibold mb-1" style={{ color: BRAND }}>
                  Pro
                </p>
                <p className="text-4xl font-bold text-slate-900">
                  {PRICING.monthly.label} <span className="text-base font-normal text-slate-400">{PRICING.monthly.per}</span>
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  or {PRICING.semester.label} for a {PRICING.semester.name} ({PRICING.semester.per})
                </p>
              </div>
              <ul className="space-y-3 flex-1">
                {PRO.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <Tick color={BRAND} />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => {
                  posthog.capture('upgrade_clicked', { plan: 'pro', page: 'landing' })
                  router.push('/signup?plan=pro')
                }}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                style={{ background: BRAND }}
              >
                Get Pro
              </button>
              <p className="text-center text-xs text-slate-400">Renews automatically. Cancel anytime in Settings.</p>
            </div>
          </div>
        </RevealOnScroll>

        <div className="mt-10 space-y-1.5 text-center text-sm text-slate-500">
          <p><span className="font-medium text-slate-700">Not happy?</span> Full refund within 14 days, no questions asked.</p>
          <p>May be paid with 529 college savings (educational software used by the student). Check with your plan.</p>
          <p>
            Can&apos;t afford it? Email{' '}
            <a href="mailto:hello@tryclassmate.com" className="font-medium text-[#5B4EE8] hover:underline">hello@tryclassmate.com</a>.
            We&apos;d rather you have it.
          </p>
        </div>
      </div>
    </section>
  )
}
