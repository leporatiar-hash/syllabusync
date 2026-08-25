// Basic tests for the founding-member upgrade prompt trigger logic (Task 2).
// No test framework in this project yet — run directly with `node lib/foundingPrompt.test.ts`
// (Node 22+ runs TypeScript natively). See package.json's "test" script.

import assert from 'node:assert/strict'
import { decideFoundingPrompt, type FoundingPromptInput } from './foundingPrompt.ts'

const base: FoundingPromptInput = {
  isPro: false,
  hasLmsConnection: false,
  hasCourses: false,
  aiGenerationsUsed: 0,
  aiGenerationsMax: 50,
  chatMessagesUsed: 0,
  chatMessagesMax: 20,
  upgradePromptDismissedAt: null,
}

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`ok - ${name}`)
  } catch (err) {
    console.error(`FAIL - ${name}`)
    throw err
  }
}

test('does not show before first sync (no LMS connection, no courses)', () => {
  const result = decideFoundingPrompt(base)
  assert.equal(result.show, false)
})

test('does not show with an LMS connection but no courses yet', () => {
  const result = decideFoundingPrompt({ ...base, hasLmsConnection: true })
  assert.equal(result.show, false)
})

test('shows "first_sync" the first time sync completes (connection + courses, never dismissed)', () => {
  const result = decideFoundingPrompt({ ...base, hasLmsConnection: true, hasCourses: true })
  assert.deepEqual(result, { show: true, reason: 'first_sync' })
})

test('never shows to a paid (Pro / founding member) user, even at the limit', () => {
  const result = decideFoundingPrompt({
    ...base,
    isPro: true,
    hasLmsConnection: true,
    hasCourses: true,
    aiGenerationsUsed: 50,
  })
  assert.equal(result.show, false)
})

test('suppressed for 7 days after dismissal', () => {
  const now = new Date('2026-08-25T00:00:00Z')
  const dismissedAt = new Date('2026-08-20T00:00:00Z').toISOString() // 5 days ago
  const result = decideFoundingPrompt({
    ...base,
    hasLmsConnection: true,
    hasCourses: true,
    upgradePromptDismissedAt: dismissedAt,
    now,
  })
  assert.equal(result.show, false)
})

test('shows again once the 7-day dismiss cooldown has passed', () => {
  const now = new Date('2026-08-28T00:00:00Z')
  const dismissedAt = new Date('2026-08-20T00:00:00Z').toISOString() // 8 days ago
  const result = decideFoundingPrompt({
    ...base,
    hasLmsConnection: true,
    hasCourses: true,
    upgradePromptDismissedAt: dismissedAt,
    now,
  })
  assert.deepEqual(result, { show: true, reason: 'first_sync' })
})

test('shows "limit_reached" as soon as the AI generation limit is hit, even mid-cooldown', () => {
  const now = new Date('2026-08-22T00:00:00Z')
  const dismissedAt = new Date('2026-08-20T00:00:00Z').toISOString() // 2 days ago — still in cooldown
  const result = decideFoundingPrompt({
    ...base,
    hasLmsConnection: true,
    hasCourses: true,
    upgradePromptDismissedAt: dismissedAt,
    now,
    aiGenerationsUsed: 50,
    aiGenerationsMax: 50,
  })
  assert.deepEqual(result, { show: true, reason: 'limit_reached' })
})

test('shows "limit_reached" when the weekly chat message limit is hit', () => {
  const result = decideFoundingPrompt({
    ...base,
    hasLmsConnection: true,
    hasCourses: true,
    chatMessagesUsed: 20,
    chatMessagesMax: 20,
  })
  assert.deepEqual(result, { show: true, reason: 'limit_reached' })
})

console.log('All foundingPrompt tests passed.')
