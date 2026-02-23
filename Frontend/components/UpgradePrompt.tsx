'use client'

import Link from 'next/link'
import { Sparkles, Zap, MessageSquare, Brain, FileText } from 'lucide-react'

interface UpgradePromptProps {
  current?: number
  max?: number
  variant?: 'inline' | 'banner' | 'promo'
}

export default function UpgradePrompt({ current, max, variant = 'inline' }: UpgradePromptProps) {
  if (variant === 'promo') {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 p-6 shadow-lg">
        {/* Decorative elements */}
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-4 -left-4 h-24 w-24 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute right-20 top-4 h-2 w-2 rounded-full bg-white/40" />
        <div className="pointer-events-none absolute left-32 bottom-8 h-1.5 w-1.5 rounded-full bg-white/30" />
        
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Unlock Pro Features</h3>
              <p className="mt-1 text-sm text-white/80">
                Get unlimited study sets, AI chat, and more
              </p>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/70">
                <span className="flex items-center gap-1">
                  <Brain size={12} /> Unlimited AI generations
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare size={12} /> AI Course Chat
                </span>
                <span className="flex items-center gap-1">
                  <FileText size={12} /> Priority support
                </span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
            <Link
              href="/upgrade"
              className="group flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-indigo-600 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              <Zap size={16} className="transition-transform group-hover:scale-110" />
              Try Pro Free for 10 Days
            </Link>
            <span className="text-xs text-white/60">No credit card required</span>
          </div>
        </div>
      </div>
    )
  }

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
