// Pure trigger logic for the founding-member upgrade prompt shown on /home
// (see WEEKLY_REVIEW_2026_08_17 Task 2). Kept separate from HomeClient so it's testable
// without rendering React.

export interface FoundingPromptInput {
  isPro: boolean
  hasLmsConnection: boolean
  hasCourses: boolean
  aiGenerationsUsed: number
  aiGenerationsMax: number | null
  chatMessagesUsed: number
  chatMessagesMax: number | null
  upgradePromptDismissedAt: string | null
  now?: Date
}

export type FoundingPromptDecision =
  | { show: false }
  | { show: true; reason: 'first_sync' | 'limit_reached' }

const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export function isAtFreeTierLimit(input: FoundingPromptInput): boolean {
  const genLimitHit = input.aiGenerationsMax !== null && input.aiGenerationsUsed >= input.aiGenerationsMax
  const chatLimitHit = input.chatMessagesMax !== null && input.chatMessagesUsed >= input.chatMessagesMax
  return genLimitHit || chatLimitHit
}

/**
 * Decide whether to show the founding-member upgrade card on /home.
 *
 * Eligibility (post first sync): at least one LMS connection AND at least one course —
 * this is the durable signal that "first successful course sync" already happened, so it
 * doesn't require a separate one-time-event flag.
 *
 * Once eligible, suppression follows the dismiss cooldown UNLESS the user is at a free-tier
 * limit, in which case it shows regardless of the cooldown ("whichever comes first").
 */
export function decideFoundingPrompt(input: FoundingPromptInput): FoundingPromptDecision {
  if (input.isPro) return { show: false }
  if (!input.hasLmsConnection || !input.hasCourses) return { show: false }

  const atLimit = isAtFreeTierLimit(input)
  if (atLimit) return { show: true, reason: 'limit_reached' }

  if (!input.upgradePromptDismissedAt) return { show: true, reason: 'first_sync' }

  const now = input.now ?? new Date()
  const dismissedAt = new Date(input.upgradePromptDismissedAt)
  const cooldownExpired = now.getTime() - dismissedAt.getTime() >= DISMISS_COOLDOWN_MS
  if (cooldownExpired) return { show: true, reason: 'first_sync' }

  return { show: false }
}
