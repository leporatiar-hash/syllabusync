// Tests for the course page's deadline grouping/formatting helpers.
// No test framework in this project — run directly with `node lib/deadlineGroups.test.ts`
// (Node 22+ runs TypeScript natively). See package.json's "test" script.

import assert from 'node:assert/strict'
import { addDays, formatDeadlineDate, groupDeadlines, localToday } from './deadlineGroups.ts'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`ok - ${name}`)
  } catch (err) {
    console.error(`FAIL - ${name}`)
    throw err
  }
}

const TODAY = '2026-09-20' // a Sunday

test('localToday uses the local calendar day, zero-padded', () => {
  assert.equal(localToday(new Date(2026, 0, 5, 23, 59)), '2026-01-05')
  assert.equal(localToday(new Date(2026, 11, 31, 0, 0)), '2026-12-31')
})

test('addDays crosses month, year and leap-day boundaries', () => {
  assert.equal(addDays('2026-09-20', 6), '2026-09-26')
  assert.equal(addDays('2026-09-28', 5), '2026-10-03')
  assert.equal(addDays('2026-12-30', 3), '2027-01-02')
  assert.equal(addDays('2028-02-28', 1), '2028-02-29')
  assert.equal(addDays('2027-02-28', 1), '2027-03-01')
})

test('groups: earlier / this week / later, with the exact boundaries', () => {
  const items = [
    { id: 'yesterday', date: '2026-09-19' },
    { id: 'today', date: '2026-09-20' },
    { id: 'day6', date: '2026-09-26' },
    { id: 'day7', date: '2026-09-27' },
    { id: 'far', date: '2026-12-01' },
  ]
  const g = groupDeadlines(items, TODAY)
  assert.deepEqual(g.earlier.map((i) => i.id), ['yesterday'])
  assert.deepEqual(g.week.map((i) => i.id), ['today', 'day6'])
  assert.deepEqual(g.later.map((i) => i.id), ['day7', 'far'])
})

test('groups are ordered: earlier newest-first, the rest soonest-first', () => {
  const items = [
    { id: 'a', date: '2026-08-01' },
    { id: 'b', date: '2026-09-10' },
    { id: 'c', date: '2026-09-25' },
    { id: 'd', date: '2026-09-21' },
    { id: 'e', date: '2027-01-01' },
    { id: 'f', date: '2026-10-05' },
  ]
  const g = groupDeadlines(items, TODAY)
  assert.deepEqual(g.earlier.map((i) => i.id), ['b', 'a'])
  assert.deepEqual(g.week.map((i) => i.id), ['d', 'c'])
  assert.deepEqual(g.later.map((i) => i.id), ['f', 'e'])
})

test('same-day items keep the order they came in', () => {
  const items = [
    { id: '1', date: '2026-09-22' },
    { id: '2', date: '2026-09-22' },
    { id: '3', date: '2026-09-22' },
  ]
  assert.deepEqual(groupDeadlines(items, TODAY).week.map((i) => i.id), ['1', '2', '3'])
})

test('missing, blank and malformed dates go last in "later" instead of vanishing or crashing', () => {
  const items = [
    { id: 'none' },
    { id: 'null', date: null },
    { id: 'blank', date: '' },
    { id: 'tbd', date: 'TBD' },
    { id: 'feb31', date: '2026-02-31' },
    { id: 'ok', date: '2026-11-01' },
  ]
  const g = groupDeadlines(items, TODAY)
  assert.deepEqual(g.later.map((i) => i.id), ['ok', 'none', 'null', 'blank', 'tbd', 'feb31'])
  assert.equal(g.earlier.length + g.week.length + g.later.length, items.length)
})

test('every item lands in exactly one group', () => {
  const items = Array.from({ length: 200 }, (_, i) => ({ id: String(i), date: addDays('2026-08-01', i) }))
  const g = groupDeadlines(items, TODAY)
  const ids = [...g.earlier, ...g.week, ...g.later].map((i) => i.id).sort()
  assert.deepEqual(ids, items.map((i) => i.id).sort())
})

test('an empty list is fine', () => {
  assert.deepEqual(groupDeadlines([], TODAY), { earlier: [], week: [], later: [] })
})

test('formatDeadlineDate: Today / Tomorrow / weekday date / year only when it differs', () => {
  assert.equal(formatDeadlineDate('2026-09-20', TODAY, 'en-US'), 'Today')
  assert.equal(formatDeadlineDate('2026-09-21', TODAY, 'en-US'), 'Tomorrow')
  assert.equal(formatDeadlineDate('2026-09-24', TODAY, 'en-US'), 'Thu, Sep 24')
  assert.equal(formatDeadlineDate('2026-09-19', TODAY, 'en-US'), 'Sat, Sep 19')
  assert.equal(formatDeadlineDate('2027-01-15', TODAY, 'en-US'), 'Fri, Jan 15, 2027')
})

test('formatDeadlineDate: unusable dates read "No date"', () => {
  for (const bad of [null, undefined, '', 'TBD', '2026-02-31', '9/20/2026']) {
    assert.equal(formatDeadlineDate(bad, TODAY, 'en-US'), 'No date')
  }
})
