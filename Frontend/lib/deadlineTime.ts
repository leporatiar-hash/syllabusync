export interface Timed {
  date?: string | null
  time?: string | null
  /** Exact due moment, ISO 8601 UTC — set for synced iCal events that have a real time. */
  due_at?: string | null
}

/** The local calendar day as YYYY-MM-DD (same as deadlineGroups' localToday; kept local so this
 * file has no imports and runs under both Next and plain `node` tests). */
function localDate(at: Date): string {
  const m = String(at.getMonth() + 1).padStart(2, '0')
  const d = String(at.getDate()).padStart(2, '0')
  return `${at.getFullYear()}-${m}-${d}`
}

/** "11:59 PM" / "9:05 AM" in the viewer's local time — same format the backend writes to `time`. */
export function formatLocalTime(at: Date): string {
  const h = at.getHours()
  const m = String(at.getMinutes()).padStart(2, '0')
  return `${h % 12 || 12}:${m} ${h < 12 ? 'AM' : 'PM'}`
}

/**
 * Show a deadline in the viewer's own timezone. Synced iCal deadlines carry `due_at` (the exact
 * moment); their `date`/`time` hold that moment in the feed's timezone (Eastern for OAKS), which is
 * wrong for a student anywhere else — an 11:59 PM ET deadline is 8:59 PM in California. Items
 * without `due_at` (all-day, manual, syllabus) come back unchanged, so their dates never shift.
 */
export function localizeDeadline<T extends Timed>(d: T): T {
  if (!d.due_at) return d
  const at = new Date(d.due_at)
  if (Number.isNaN(at.getTime())) return d
  return { ...d, date: localDate(at), time: formatLocalTime(at) }
}
