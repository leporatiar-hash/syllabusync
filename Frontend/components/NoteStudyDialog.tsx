'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, Check, FileText, HelpCircle, Layers, Sparkles } from 'lucide-react'
import posthog from 'posthog-js'
import { API_URL, useAuthFetch } from '../hooks/useAuthFetch'
import { joinNotesForStudy, noteAsText, studyFileName } from '../lib/noteMarkdown'

// Same ceiling the chat uses for generation input; keeps a "use all my notes" run to a handful of AI calls.
const MAX_STUDY_CHARS = 60_000
const MIN_STUDY_CHARS = 50 // the generators refuse anything with less text than this

type Kind = 'flashcards' | 'quiz' | 'summary'

// The generators take an uploaded file, so a note is sent as a small .txt — the same endpoints
// (and free-tier limits) the Study Tools tab uses.
const KINDS: {
  key: Kind
  label: string
  hint: string
  path: string
  icon: typeof Layers
  color: string
  cta: string
  href: (data: any) => string // eslint-disable-line @typescript-eslint/no-explicit-any
}[] = [
  { key: 'flashcards', label: 'Flashcards', hint: '10–20 question/answer cards', path: 'flashcards', icon: Layers, color: 'text-[#5B8DEF]', cta: 'Study flashcards', href: (d) => `/flashcards?set=${d.flashcard_set.id}` },
  { key: 'quiz', label: 'Mini quiz', hint: '5–10 multiple choice questions', path: 'generate-quiz', icon: HelpCircle, color: 'text-[#A78BFA]', cta: 'Take the quiz', href: (d) => `/quizzes/${d.quiz.id}` },
  { key: 'summary', label: 'Summary', hint: 'A short AI study summary', path: 'summaries', icon: FileText, color: 'text-[#38BDF8]', cta: 'Read the summary', href: (d) => `/summaries/${d.id}` },
]

interface Outcome {
  kind: Kind
  ok: boolean
  href?: string
  message?: string
  upgrade?: boolean
}

export default function NoteStudyDialog({
  courseId,
  courseName,
  note,
  noteCount,
  beforeGenerate,
  onClose,
  onCreated,
}: {
  courseId: string
  courseName?: string
  note: { title: string; content: string }
  noteCount: number
  /** Called first so the open note's pending autosave lands before anything is read from the server. */
  beforeGenerate: () => Promise<unknown>
  onClose: () => void
  onCreated: () => void
}) {
  const { fetchWithAuth } = useAuthFetch()
  const [source, setSource] = useState<'note' | 'all'>('note')
  const [selected, setSelected] = useState<Record<Kind, boolean>>({ flashcards: true, quiz: true, summary: true })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [outcomes, setOutcomes] = useState<Outcome[] | null>(null)
  const [usedNotice, setUsedNotice] = useState<string | null>(null)

  const chosen = KINDS.filter((k) => selected[k.key])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const generate = async () => {
    setBusy(true)
    setError(null)
    setOutcomes(null)
    setUsedNotice(null)
    try {
      await beforeGenerate()

      let text: string
      let name: string
      if (source === 'note') {
        text = noteAsText(note.title, note.content)
        name = note.title
      } else {
        const res = await fetchWithAuth(`${API_URL}/courses/${courseId}/notes?full=true`, { cache: 'no-store' })
        if (!res.ok) throw new Error("Couldn't load your notes. Please try again.")
        const all: { title: string; content?: string }[] = await res.json()
        const joined = joinNotesForStudy(all.map((n) => ({ title: n.title, content: n.content || '' })), MAX_STUDY_CHARS)
        text = joined.text
        name = `${courseName || 'Class'} notes`
        if (joined.used < all.filter((n) => (n.content || '').trim()).length) {
          setUsedNotice(`Used your ${joined.used} most recently edited notes (that's the most that fits in one go).`)
        }
      }
      if (text.trim().length < MIN_STUDY_CHARS) {
        throw new Error('There isn’t enough text yet. Write a little more (a few sentences) and try again.')
      }

      const file = new File([text], studyFileName(name), { type: 'text/plain' })
      const settled = await Promise.allSettled(
        chosen.map(async (k) => {
          const form = new FormData()
          form.append('file', file)
          const res = await fetchWithAuth(`${API_URL}/courses/${courseId}/${k.path}`, { method: 'POST', body: form, cache: 'no-store' })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) throw Object.assign(new Error('failed'), { status: res.status, detail: data?.detail })
          return data
        }),
      )

      const results: Outcome[] = settled.map((r, i) => {
        const k = chosen[i]
        if (r.status === 'fulfilled') return { kind: k.key, ok: true, href: k.href(r.value) }
        const detail = (r.reason as { detail?: unknown })?.detail
        if (detail && typeof detail === 'object' && (detail as { error?: string }).error === 'limit_reached') {
          return { kind: k.key, ok: false, upgrade: true, message: (detail as { message?: string }).message || 'Monthly AI limit reached.' }
        }
        return { kind: k.key, ok: false, message: typeof detail === 'string' ? detail : 'Something went wrong. Please try again.' }
      })
      setOutcomes(results)

      const okKinds = results.filter((r) => r.ok).map((r) => r.kind)
      if (okKinds.length > 0) {
        posthog.capture('note_study_tools_generated', { course_id: courseId, source, kinds: okKinds })
        onCreated()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur sm:items-center sm:px-4"
      onClick={() => !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="note-study-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-6 shadow-xl animate-[slideUp_0.25s_ease-out] sm:rounded-3xl sm:p-8"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#EEF2FF] to-[#F0FDFF]">
            <Sparkles size={18} className="text-[#5B8DEF]" />
          </div>
          <div className="min-w-0">
            <h2 id="note-study-title" className="text-lg font-semibold text-slate-900">Make study tools</h2>
            <p className="mt-0.5 text-sm text-slate-500">Turn your notes into something to study with.</p>
          </div>
        </div>

        {outcomes ? (
          <div className="mt-6">
            <ul className="space-y-2">
              {outcomes.map((o) => {
                const k = KINDS.find((x) => x.key === o.kind)!
                const Icon = k.icon
                return (
                  <li key={o.kind} className={`rounded-2xl border p-4 ${o.ok ? 'border-[#4ADE80]/40 bg-[#ECFDF3]' : 'border-[#FB7185]/40 bg-[#FEF2F2]'}`}>
                    <div className="flex items-center gap-3">
                      <Icon size={18} className={k.color} />
                      <span className="flex-1 font-medium text-slate-900">{k.label}</span>
                      {o.ok ? (
                        <Link href={o.href!} className="flex min-h-11 items-center rounded-full bg-white px-4 text-sm font-semibold text-[#5B8DEF] shadow-sm">
                          {k.cta}
                        </Link>
                      ) : (
                        <AlertCircle size={18} className="text-[#FB7185]" />
                      )}
                    </div>
                    {!o.ok && (
                      <p className="mt-2 text-xs text-slate-600">
                        {o.message}{' '}
                        {o.upgrade && (
                          <Link href="/upgrade" className="font-semibold text-[#5B8DEF] underline">
                            See plans
                          </Link>
                        )}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
            {usedNotice && <p className="mt-3 text-xs text-slate-500">{usedNotice}</p>}
            {outcomes.some((o) => o.ok) && (
              <p className="mt-3 text-xs text-slate-500">Saved to this class&apos;s Study Tools tab too.</p>
            )}
            <button
              onClick={onClose}
              className="mt-6 min-h-11 w-full rounded-full border border-slate-200 px-5 text-sm text-slate-600 transition-all duration-300 hover:border-slate-300"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            {noteCount > 1 && (
              <fieldset className="mt-6">
                <legend className="mb-2 text-sm font-semibold text-slate-700">Use</legend>
                <div className="space-y-2">
                  {([
                    ['note', 'This note'],
                    ['all', `All ${noteCount} notes in this class`],
                  ] as const).map(([value, label]) => (
                    <label key={value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-4 py-2 transition-all duration-300 hover:border-[#5B8DEF] has-[:checked]:border-[#5B8DEF] has-[:checked]:bg-[#EEF2FF]/40">
                      <input
                        type="radio"
                        name="note-study-source"
                        checked={source === value}
                        onChange={() => setSource(value)}
                        className="h-5 w-5 accent-[#5B8DEF]"
                      />
                      <span className="text-sm text-slate-800">{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            <fieldset className="mt-6">
              <legend className="mb-2 text-sm font-semibold text-slate-700">Create</legend>
              <div className="space-y-2">
                {KINDS.map((k) => {
                  const Icon = k.icon
                  return (
                    <label key={k.key} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-4 py-2.5 transition-all duration-300 hover:border-[#5B8DEF] hover:bg-[#EEF2FF]/30">
                      <input
                        type="checkbox"
                        checked={selected[k.key]}
                        onChange={(e) => setSelected((prev) => ({ ...prev, [k.key]: e.target.checked }))}
                        className="h-5 w-5 rounded border-slate-300 accent-[#5B8DEF]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Icon size={16} className={k.color} />
                          <span className="font-medium text-slate-900">{k.label}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">{k.hint}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <p className="mt-3 text-xs text-slate-400">
              {chosen.length === 0
                ? 'Pick at least one.'
                : `Uses ${chosen.length} AI generation${chosen.length > 1 ? 's' : ''} from your plan.`}
            </p>

            {error && (
              <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-700">
                {error}
              </p>
            )}

            <div className="sticky bottom-0 -mx-6 -mb-6 mt-4 flex items-center justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4 sm:-mx-8 sm:-mb-8 sm:px-8">
              <button
                onClick={onClose}
                disabled={busy}
                className="min-h-11 rounded-full border border-slate-200 px-5 text-sm text-slate-600 transition-all duration-300 hover:border-slate-300 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void generate()}
                disabled={busy || chosen.length === 0}
                className="flex min-h-11 items-center gap-2 rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-5 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Generating…
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    Generate
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
