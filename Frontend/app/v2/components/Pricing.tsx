'use client'

import { useRouter } from 'next/navigation'
import RevealOnScroll from './RevealOnScroll'
import { BRAND } from './tokens'

export default function Pricing() {
  const router = useRouter()

  return (
    <section id="pricing" className="py-24 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">Simple, honest pricing</h2>
          <p className="text-lg text-slate-500">Start free. Upgrade when you&apos;re ready.</p>
        </div>

        <RevealOnScroll className="grid md:grid-cols-3 gap-6 items-start">
          {/* Free */}
          <div className="rounded-2xl border border-slate-200 p-8 flex flex-col gap-6 bg-white">
            <div>
              <p className="text-sm font-semibold text-slate-500 mb-1">Free</p>
              <p className="text-4xl font-bold text-slate-900">
                $0 <span className="text-base font-normal text-slate-400">/forever</span>
              </p>
            </div>
            <ul className="space-y-3 flex-1">
              {['3 courses', 'Syllabus deadline extraction', 'Calendar view', 'AI chat — 10 messages/week', '50 AI generations/month'].map(
                (f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-slate-700">
                    <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                )
              )}
            </ul>
            <button
              onClick={() => router.push('/signup')}
              className="w-full py-3 rounded-xl border-2 border-slate-200 text-sm font-semibold text-slate-700 hover:border-[#5B4EE8] hover:text-[#5B4EE8] transition-colors"
            >
              Get started free
            </button>
          </div>

          {/* Pro — featured */}
          <div className="relative flex flex-col">
            <div className="flex justify-center mb-3">
              <span className="rounded-full px-4 py-1 text-xs font-bold text-white" style={{ background: BRAND }}>
                Most popular
              </span>
            </div>
            <div className="rounded-2xl p-8 flex flex-col gap-6 bg-white" style={{ border: '2px solid #5B4EE8' }}>
              <div>
                <p className="text-sm font-semibold mb-1" style={{ color: BRAND }}>
                  Pro
                </p>
                <p className="text-4xl font-bold text-slate-900">
                  $4.99 <span className="text-base font-normal text-slate-400">/month</span>
                </p>
              </div>
              <ul className="space-y-3 flex-1">
                {['Unlimited courses', 'Unlimited AI chat', 'Unlimited flashcards & quizzes', 'Canvas + iCal sync', 'AI study summaries', 'Priority support'].map(
                  (f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-slate-700">
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: BRAND }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  )
                )}
              </ul>
              <button
                onClick={() => router.push('/signup?plan=pro')}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                style={{ background: BRAND }}
              >
                Start 10-Day Free Trial
              </button>
              <p className="text-center text-xs text-slate-400 mt-2">
                After 10 days, you stay on the free plan. No charge, no gotcha.
              </p>
            </div>
          </div>

          {/* Semester */}
          <div className="rounded-2xl border border-slate-200 p-8 flex flex-col gap-6 bg-white">
            <div>
              <p className="text-sm font-semibold text-slate-500 mb-1">Semester</p>
              <p className="text-4xl font-bold text-slate-900">
                $20 <span className="text-base font-normal text-slate-400">/semester</span>
              </p>
            </div>
            <ul className="space-y-3 flex-1">
              {['Everything in Pro', 'Save 37% vs monthly', 'Semester-length access', 'Early access to new features'].map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-slate-700">
                  <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => router.push('/signup?plan=semester')}
              className="w-full py-3 rounded-xl border-2 border-slate-200 text-sm font-semibold text-slate-700 hover:border-[#5B4EE8] hover:text-[#5B4EE8] transition-colors"
            >
              Get semester plan
            </button>
          </div>
        </RevealOnScroll>

        <p className="text-center text-sm text-slate-400 mt-8">No credit card required · 10-day Pro trial included · Cancel anytime</p>
      </div>
    </section>
  )
}
