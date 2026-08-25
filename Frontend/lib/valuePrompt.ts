// Pure trigger logic for the one-question value-prop feedback ask (Task 4).
// Kept separate from HomeClient so it's testable without rendering React.

export interface ValuePromptInput {
  sessionCount: number
  accountCreatedAt: string | null
  valuePromptShownAt: string | null
  now?: Date
}

const ACCOUNT_AGE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const SESSION_THRESHOLD = 3

/**
 * Show once, ever: eligible once the account is 7+ days old OR the user has had
 * 3+ sessions, whichever comes first — but never again once value_prompt_shown_at is set.
 */
export function shouldShowValuePrompt(input: ValuePromptInput): boolean {
  if (input.valuePromptShownAt) return false
  if (!input.accountCreatedAt) return false

  const now = input.now ?? new Date()
  const createdAt = new Date(input.accountCreatedAt)
  const accountAgeMet = now.getTime() - createdAt.getTime() >= ACCOUNT_AGE_THRESHOLD_MS
  const sessionsMet = input.sessionCount >= SESSION_THRESHOLD

  return accountAgeMet || sessionsMet
}
