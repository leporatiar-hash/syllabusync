// Basic tests for the value-prop prompt trigger logic (Task 4).
// No test framework in this project yet — run directly with `node lib/valuePrompt.test.ts`
// (Node 22+ runs TypeScript natively). See package.json's "test" script.

import assert from 'node:assert/strict'
import { shouldShowValuePrompt, type ValuePromptInput } from './valuePrompt.ts'

const base: ValuePromptInput = {
  sessionCount: 0,
  accountCreatedAt: new Date().toISOString(),
  valuePromptShownAt: null,
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

test('does not show for a brand-new account with few sessions', () => {
  assert.equal(shouldShowValuePrompt(base), false)
})

test('shows once session count reaches 3', () => {
  assert.equal(shouldShowValuePrompt({ ...base, sessionCount: 3 }), true)
})

test('does not show at 2 sessions', () => {
  assert.equal(shouldShowValuePrompt({ ...base, sessionCount: 2 }), false)
})

test('shows once account age reaches 7 days, even with 0 sessions', () => {
  const now = new Date('2026-08-25T00:00:00Z')
  const createdAt = new Date('2026-08-18T00:00:00Z').toISOString() // 7 days ago
  assert.equal(
    shouldShowValuePrompt({ ...base, accountCreatedAt: createdAt, sessionCount: 0, now }),
    true,
  )
})

test('does not show before 7 days if sessions are also below threshold', () => {
  const now = new Date('2026-08-25T00:00:00Z')
  const createdAt = new Date('2026-08-20T00:00:00Z').toISOString() // 5 days ago
  assert.equal(
    shouldShowValuePrompt({ ...base, accountCreatedAt: createdAt, sessionCount: 1, now }),
    false,
  )
})

test('never shows again once value_prompt_shown_at is set, even if otherwise eligible', () => {
  assert.equal(
    shouldShowValuePrompt({ ...base, sessionCount: 10, valuePromptShownAt: new Date().toISOString() }),
    false,
  )
})

console.log('All valuePrompt tests passed.')
