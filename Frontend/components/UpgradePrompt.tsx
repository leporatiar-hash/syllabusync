'use client'

import Link from 'next/link'

interface UpgradePromptProps {
  current?: number
  max?: number
  variant?: 'inline' | 'banner'
}

export default function UpgradePrompt({ current, max, variant = 'inline' }: UpgradePromptProps) {
  if (variant === 'banner') {
    return (
      <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 flex items-center justify-between gap-4 shadow-sm">
        <p className="text-sm font-medium text-amber-800">
          You&apos;ve used your free study sets this month
        </p>
        <Link
          href="/upgrade"
          className="shrink-0 rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          Upgrade to Pro
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 p-8 text-center shadow-md">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
        <svg className="h-7 w-7 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
        </svg>
      </div>
      <h3 className="text-xl font-bold text-slate-900">You&apos;ve used all your free study sets</h3>
      <p className="mt-2 text-sm text-slate-600">
        {current ?? 0} of {max ?? 5} AI generations used this month.
        Upgrade to Pro for unlimited flashcards, quizzes, and summaries.
      </p>
      <Link
        href="/upgrade"
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-8 py-3 text-base font-bold text-white shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl"
      >
        Upgrade to Pro — 10 days free
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
        </svg>
      </Link>
      <p className="mt-2 text-xs text-slate-400">No charge for 10 days. Cancel anytime.</p>
    </div>
  )
}
