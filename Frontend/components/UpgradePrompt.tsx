'use client'

import Link from 'next/link'

interface UpgradePromptProps {
  type: 'courses' | 'ai_generations'
  current?: number
  max?: number
}

export default function UpgradePrompt({ type, current, max }: UpgradePromptProps) {
  const title =
    type === 'courses' ? 'Course limit reached' : 'Generation limit reached'

  const description =
    type === 'courses'
      ? `You\u2019ve used ${current ?? 0} of ${max ?? 3} courses on the free plan.`
      : `You\u2019ve used ${current ?? 0} of ${max ?? 5} AI generations this month.`

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-6 text-center">
      <h3 className="text-lg font-semibold text-amber-900">{title}</h3>
      <p className="mt-1 text-sm text-amber-700">{description}</p>
      <Link
        href="/upgrade"
        className="mt-4 inline-block rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
      >
        Upgrade to Pro
      </Link>
    </div>
  )
}
