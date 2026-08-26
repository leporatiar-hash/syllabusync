'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import posthog from 'posthog-js'

interface Props {
  reason: 'first_sync' | 'limit_reached'
  onDismiss: () => void
}

export default function FoundingMemberPrompt({ reason, onDismiss }: Props) {
  useEffect(() => {
    posthog.capture('founding_member_prompt_shown', { reason })
  }, [reason])

  const handleUpgradeClick = () => {
    posthog.capture('founding_member_prompt_clicked', { reason })
  }

  const handleDismiss = () => {
    posthog.capture('founding_member_prompt_dismissed', { reason })
    onDismiss()
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-amber-900">
            {reason === 'limit_reached' ? "You've hit the free limit." : "You're set up."}
          </h3>
          <p className="mt-1 text-sm text-amber-800">
            Lock in Founding Member for $15, once — a full year of unlimited AI generations
            and chat.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/founding"
            onClick={handleUpgradeClick}
            className="rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            Get Founding Member
          </Link>
          <button
            onClick={handleDismiss}
            className="rounded-full px-4 py-2.5 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-100/60"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  )
}
