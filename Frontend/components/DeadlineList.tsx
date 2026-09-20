'use client'

import { Calendar, Check } from 'lucide-react'
import { formatDeadlineDate, groupDeadlines } from '../lib/deadlineGroups'

export interface DeadlineItem {
  id: string
  date: string
  time?: string
  type: string
  title: string
  description?: string
  context?: string
  completed?: boolean
  saved_to_calendar?: boolean
}

/**
 * The course page's deadline list: one calm list grouped by "This week" / "Later" (past items tucked away),
 * with each row showing whether it's on the student's calendar. Replaces the old Unsaved / In Calendar toggle,
 * which hid the real content behind an empty state.
 */
export default function DeadlineList({
  deadlines,
  today,
  savingId,
  bulkSaving,
  badgeClassFor,
  onToggleComplete,
  onSave,
  onRemove,
  onSaveAll,
}: {
  deadlines: DeadlineItem[]
  today: string
  savingId: string | null
  bulkSaving: boolean
  badgeClassFor: (type: string) => string
  onToggleComplete: (id: string) => void
  onSave: (id: string) => void
  onRemove: (id: string) => void
  onSaveAll: () => void
}) {
  const groups = groupDeadlines(deadlines, today)
  const unsaved = deadlines.filter((d) => !d.saved_to_calendar).length
  const saved = deadlines.length - unsaved

  const renderRow = (d: DeadlineItem) => {
    const busy = savingId === d.id
    const description = d.description || d.context
    return (
      <li key={d.id} className="flex items-start gap-3 py-3">
        <label className="-m-2 flex shrink-0 cursor-pointer p-2">
          <input
            type="checkbox"
            checked={d.completed || false}
            onChange={() => onToggleComplete(d.id)}
            aria-label={`Mark "${d.title || 'deadline'}" as ${d.completed ? 'not done' : 'done'}`}
            className="mt-0.5 h-5 w-5 cursor-pointer rounded border-slate-300 accent-[#5B8DEF]"
          />
        </label>
        {/* Phones: title, then a second line with date / type / calendar. Wider screens: all on one line. */}
        <div className="min-w-0 flex-1 sm:flex sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h3 className={`text-[15px] font-medium leading-snug ${d.completed ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
              {d.title || 'Untitled deadline'}
            </h3>
            {description && <p className="mt-0.5 line-clamp-2 text-sm leading-relaxed text-slate-500">{description}</p>}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:mt-0 sm:shrink-0 sm:flex-nowrap sm:justify-end">
            <span className="font-medium text-slate-700">{formatDeadlineDate(d.date, today)}</span>
            {d.time && <span className="text-slate-400">{d.time}</span>}
            <span className={`rounded-full px-2.5 py-0.5 font-semibold ${badgeClassFor(d.type)}`}>{d.type}</span>
            {d.saved_to_calendar ? (
              <span className="inline-flex items-center">
                <span className="inline-flex items-center gap-1 font-medium text-[#22A55A]">
                  <Check size={13} strokeWidth={2.5} /> On your calendar
                </span>
                <button
                  onClick={() => onRemove(d.id)}
                  disabled={busy}
                  className="ml-1 min-h-11 rounded-full px-2 font-medium text-slate-400 transition-colors hover:text-red-500 disabled:opacity-50 sm:min-h-8"
                >
                  {busy ? 'Removing…' : 'Remove'}
                </button>
              </span>
            ) : (
              <button
                onClick={() => onSave(d.id)}
                disabled={busy}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 font-semibold text-slate-600 transition-all duration-300 hover:border-[#5B8DEF] hover:bg-[#EEF2FF] hover:text-[#5B8DEF] disabled:opacity-50 sm:min-h-8"
              >
                {busy ? (
                  'Saving…'
                ) : (
                  <>
                    <Calendar size={13} /> Add to calendar
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </li>
    )
  }

  const section = (label: string, items: typeof deadlines) =>
    items.length === 0 ? null : (
      <div className="mt-6 first:mt-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</h3>
        <ul className="mt-1 divide-y divide-slate-100">{items.map(renderRow)}</ul>
      </div>
    )

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-1 text-lg font-semibold text-slate-900">Timeline</h2>
          <span className="rounded-full bg-[#DCFCE7] px-3 py-1 text-xs font-semibold text-[#22A55A]">{saved} on calendar</span>
          {unsaved > 0 && (
            <span className="rounded-full bg-[#FFEDD5] px-3 py-1 text-xs font-semibold text-[#FB923C]">{unsaved} not saved</span>
          )}
        </div>
        {unsaved > 0 && (
          <button
            onClick={onSaveAll}
            disabled={bulkSaving}
            className="min-h-11 rounded-full bg-[#5B8DEF] px-5 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:bg-[#4A7BDD] disabled:opacity-50 sm:min-h-9"
          >
            {bulkSaving ? 'Adding…' : `Add ${unsaved} to calendar`}
          </button>
        )}
      </div>

      {section('This week', groups.week)}
      {section('Later', groups.later)}

      {groups.earlier.length > 0 && (
        // Past deadlines are tucked away unless they're all there is (e.g. a finished semester)
        <details open={groups.week.length + groups.later.length === 0} className="mt-6">
          <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 hover:text-slate-600">
            Earlier ({groups.earlier.length})
          </summary>
          <ul className="mt-1 divide-y divide-slate-100">{groups.earlier.map(renderRow)}</ul>
        </details>
      )}
    </section>
  )
}
