'use client'

import Link from 'next/link'
import { Check, GraduationCap, MessageCircle, NotebookPen } from 'lucide-react'

/**
 * Shown on the Deadlines tab once every deadline is on the student's calendar. Getting the deadlines in is only
 * the start; the value is in the other tabs, which are easy to miss, so point at them. Each tile disappears once
 * that feature has been used, and the whole strip goes away when there's nothing left to suggest.
 */
export default function NextSteps({
  deadlineCount,
  showNotes,
  showStudy,
  onOpenNotes,
  onOpenStudy,
}: {
  deadlineCount: number
  showNotes: boolean
  showStudy: boolean
  onOpenNotes: () => void
  onOpenStudy: () => void
}) {
  const tile =
    'flex min-h-[4.5rem] items-start gap-3 rounded-2xl border border-white/80 bg-white p-4 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md'
  return (
    <section className="rounded-3xl bg-gradient-to-br from-[#F3F7FF] to-[#F7F3FF] p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#DCFCE7] text-[#22A55A]">
          <Check size={15} strokeWidth={2.75} />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {deadlineCount === 1 ? 'Your deadline is' : `All ${deadlineCount} deadlines are`} on your calendar
          </h2>
          <p className="mt-0.5 text-sm text-slate-600">Now let ClassMate help you get ready for them:</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-flow-col sm:auto-cols-fr">
        {showStudy && (
          <button onClick={onOpenStudy} className={tile}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E0EAFF] text-[#5B8DEF]">
              <GraduationCap size={18} />
            </span>
            <span>
              <span className="block text-sm font-semibold text-slate-900">Make flashcards &amp; quizzes</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">Turn slides, readings or notes into study sets.</span>
            </span>
          </button>
        )}
        {showNotes && (
          <button onClick={onOpenNotes} className={tile}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F3E8FF] text-[#A78BFA]">
              <NotebookPen size={18} />
            </span>
            <span>
              <span className="block text-sm font-semibold text-slate-900">Take notes for this class</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">Write, search, and turn notes into flashcards.</span>
            </span>
          </button>
        )}
        <Link href="/chat" className={tile}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#DCFCE7] text-[#22A55A]">
            <MessageCircle size={18} />
          </span>
          <span>
            <span className="block text-sm font-semibold text-slate-900">Ask ClassMate</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">Grading, due dates, or a study plan. Just ask.</span>
          </span>
        </Link>
      </div>
    </section>
  )
}
