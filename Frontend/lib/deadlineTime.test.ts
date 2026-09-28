// Tests for rendering synced deadlines in the viewer's local timezone.
// No test framework in this project — run directly with `node lib/deadlineTime.test.ts`
// (Node 22+ runs TypeScript natively). Node re-reads process.env.TZ when it's assigned, so each
// test pins the viewer's timezone itself.

import assert from 'node:assert/strict'
import { formatLocalTime, localizeDeadline } from './deadlineTime.ts'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`ok - ${name}`)
  } catch (err) {
    console.error(`FAIL - ${name}`)
    throw err
  }
}

// As the backend stores them for an OAKS feed (date/time in Eastern, due_at in UTC)
const EXAM = { title: 'Exam 2', date: '2026-10-15', time: '12:15 PM', due_at: '2026-10-15T16:15:00+00:00' }
const HOMEWORK = { title: 'Homework 4', date: '2026-10-15', time: '11:59 PM', due_at: '2026-10-16T03:59:00+00:00' }

test('Eastern viewer: 12:15 PM ET exam shows 12:15 PM on the same day', () => {
  process.env.TZ = 'America/New_York'
  const d = localizeDeadline(EXAM)
  assert.equal(d.date, '2026-10-15')
  assert.equal(d.time, '12:15 PM')
})

test('Eastern viewer: 11:59 PM ET deadline stays on its day (not the next UTC day)', () => {
  process.env.TZ = 'America/New_York'
  const d = localizeDeadline(HOMEWORK)
  assert.equal(d.date, '2026-10-15')
  assert.equal(d.time, '11:59 PM')
})

test('Pacific viewer sees the same moments in their own time', () => {
  process.env.TZ = 'America/Los_Angeles'
  assert.deepEqual([localizeDeadline(EXAM).date, localizeDeadline(EXAM).time], ['2026-10-15', '9:15 AM'])
  assert.deepEqual([localizeDeadline(HOMEWORK).date, localizeDeadline(HOMEWORK).time], ['2026-10-15', '8:59 PM'])
})

test('London viewer: the 11:59 PM ET deadline is early the next morning', () => {
  process.env.TZ = 'Europe/London'
  assert.deepEqual([localizeDeadline(HOMEWORK).date, localizeDeadline(HOMEWORK).time], ['2026-10-16', '4:59 AM'])
})

test('all-day and manual items (no due_at) are returned untouched, in any timezone', () => {
  const allDay = { title: 'Reading Day', date: '2026-10-20', time: null, due_at: null }
  const manual = { title: 'Essay', date: '2026-10-21', time: '5:00 PM' }
  for (const tz of ['Pacific/Honolulu', 'America/New_York', 'Asia/Tokyo']) {
    process.env.TZ = tz
    assert.equal(localizeDeadline(allDay), allDay)
    assert.equal(localizeDeadline(manual), manual)
  }
})

test('keeps other fields and does not mutate the input', () => {
  process.env.TZ = 'America/Los_Angeles'
  const input = { ...HOMEWORK, id: 'x1', course_code: 'FINC 400' }
  const d = localizeDeadline(input)
  assert.equal(d.id, 'x1')
  assert.equal(d.course_code, 'FINC 400')
  assert.equal(input.time, '11:59 PM')
})

test('unparseable due_at falls back to the stored date/time', () => {
  const bad = { date: '2026-10-15', time: '11:59 PM', due_at: 'not-a-date' }
  assert.equal(localizeDeadline(bad), bad)
})

test('formatLocalTime: midnight, noon, zero-padded minutes, plain space', () => {
  process.env.TZ = 'UTC'
  assert.equal(formatLocalTime(new Date('2026-10-15T00:05:00Z')), '12:05 AM')
  assert.equal(formatLocalTime(new Date('2026-10-15T12:00:00Z')), '12:00 PM')
  assert.equal(formatLocalTime(new Date('2026-10-15T09:07:00Z')), '9:07 AM')
})
