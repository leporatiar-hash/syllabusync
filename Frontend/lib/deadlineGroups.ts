// Grouping and formatting for the course page's deadline list. Pure functions (no React/DOM) so the
// date edge cases are testable with `node lib/deadlineGroups.test.ts`.
//
// Deadline dates are plain "YYYY-MM-DD" strings (no time zone). Everything here works on those strings and
// on the viewer's LOCAL calendar day, so "today" never shifts by a UTC offset.

interface Dated {
  date?: string | null
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** The viewer's local calendar day as YYYY-MM-DD. */
export function localToday(now: Date = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${m}-${d}`
}

function parseIso(iso: string): Date | null {
  const m = ISO_DATE.exec(iso)
  if (!m) return null
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  // reject rollovers like 2026-02-31
  return date.getMonth() === Number(m[2]) - 1 ? date : null
}

export function addDays(iso: string, days: number): string {
  const d = parseIso(iso)
  if (!d) return iso
  d.setDate(d.getDate() + days)
  return localToday(d)
}

export interface DeadlineGroups<T> {
  /** Before today, most recent first. */
  earlier: T[]
  /** Today through the next 6 days, soonest first. */
  week: T[]
  /** Further out, soonest first, then anything without a usable date. */
  later: T[]
}

export function groupDeadlines<T extends Dated>(items: T[], today: string): DeadlineGroups<T> {
  const weekEnd = addDays(today, 6)
  const earlier: T[] = []
  const week: T[] = []
  const later: T[] = []
  const undated: T[] = []
  for (const item of items) {
    const d = item.date ?? ''
    if (!parseIso(d)) undated.push(item)
    else if (d < today) earlier.push(item)
    else if (d <= weekEnd) week.push(item)
    else later.push(item)
  }
  // Array.prototype.sort is stable, so equal dates keep the order the server gave them
  const byDate = (a: T, b: T) => (a.date! < b.date! ? -1 : a.date! > b.date! ? 1 : 0)
  earlier.sort((a, b) => byDate(b, a))
  week.sort(byDate)
  later.sort(byDate)
  return { earlier, week, later: [...later, ...undated] }
}

/** "Today", "Tomorrow", "Wed, Sep 24" (year added when it isn't this year), or "No date". */
export function formatDeadlineDate(iso: string | null | undefined, today: string, locale?: string): string {
  const d = parseIso(iso ?? '')
  if (!d) return 'No date'
  if (iso === today) return 'Today'
  if (iso === addDays(today, 1)) return 'Tomorrow'
  const thisYear = parseIso(today)?.getFullYear()
  return d.toLocaleDateString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== thisYear ? 'numeric' : undefined,
  })
}
