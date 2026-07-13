'use client'

import { useEffect, useRef, useState } from 'react'
import type { SceneProps } from './constants'

// Colors pulled from the real course-color palette (lib/courseColors.ts) —
// pills in the actual calendar are colored per-course, not per-type.
const week = [
  { label: 'S', date: 13 },
  { label: 'M', date: 14 },
  { label: 'T', date: 15, today: true },
  { label: 'W', date: 16 },
  { label: 'T', date: 17 },
  { label: 'F', date: 18 },
  { label: 'S', date: 19 },
]

const events = [
  { course: 'BIO 101', title: 'Pop Quiz', date: 'Sep 14', color: '#FB923C', dotDay: 14 },
  { course: 'FINC 382', title: 'Homework 3', date: 'Sep 16', color: '#F472B6', dotDay: 16 },
  { course: 'FINC 400', title: 'Midterm Exam', date: 'Sep 17', color: '#FBBF24', dotDay: 17 },
  { course: 'ENTR 360', title: 'Pitch Presentation', date: 'Sep 18', color: '#5B8DEF', dotDay: 18 },
]

export default function CalendarScene({ reducedMotion }: SceneProps) {
  const [visibleCount, setVisibleCount] = useState(reducedMotion ? events.length : 0)
  const [showSave, setShowSave] = useState(reducedMotion)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    const clear = () => {
      timers.current.forEach(clearTimeout)
      timers.current = []
    }
    if (reducedMotion) {
      timers.current.push(setTimeout(() => {
        setVisibleCount(events.length)
        setShowSave(true)
      }, 0))
      return clear
    }
    events.forEach((_, i) => {
      timers.current.push(setTimeout(() => setVisibleCount((c) => Math.max(c, i + 1)), 400 + i * 380))
    })
    timers.current.push(setTimeout(() => setShowSave(true), 400 + events.length * 380 + 300))
    return clear
  }, [reducedMotion])

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Month header + Today pill, matching the real calendar page */}
      <div className="shrink-0 flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <p className="text-base font-semibold text-slate-900">September 2026</p>
        <span className="rounded-full border border-[#5B8DEF] px-3 py-1 text-xs font-semibold text-[#5B8DEF]">
          Today
        </span>
      </div>

      {/* Compact week strip */}
      <div className="shrink-0 grid grid-cols-7 gap-1 border-b border-slate-100 px-3 py-3">
        {week.map((d) => {
          const revealed = events.slice(0, visibleCount)
          const dot = revealed.find((e) => e.dotDay === d.date)
          return (
            <div key={d.date} className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-medium text-slate-400">{d.label}</span>
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                  d.today ? 'bg-[#5B8DEF] text-white' : 'text-slate-700'
                }`}
              >
                {d.date}
              </span>
              <span
                className="h-1.5 w-1.5 rounded-full transition-opacity"
                style={{ background: dot ? dot.color : 'transparent', opacity: dot ? 1 : 0 }}
              />
            </div>
          )
        })}
      </div>

      {/* Agenda pills — solid course colors, matching the real month-grid badges */}
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {events.slice(0, visibleCount).map((e) => (
          <div
            key={e.title}
            className="msg-in flex items-center justify-between gap-3 rounded-lg px-3.5 py-2.5"
            style={{ background: e.color }}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{e.title}</p>
              <p className="truncate text-[11px] text-white/80">{e.course}</p>
            </div>
            <span className="shrink-0 text-xs font-medium text-white/90">{e.date}</span>
          </div>
        ))}
      </div>

      {showSave && (
        <div className="shrink-0 border-t border-slate-100 px-4 py-3 msg-in">
          <div className="w-full rounded-2xl border border-slate-200 bg-white py-3 text-center text-sm font-semibold text-[#5B8DEF] shadow-sm">
            Save All ({events.length}) to Calendar
          </div>
        </div>
      )}
    </div>
  )
}
