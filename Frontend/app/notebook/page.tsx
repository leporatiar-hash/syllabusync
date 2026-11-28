'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight, NotebookPen } from 'lucide-react'
import posthog from 'posthog-js'
import { API_URL, useAuthFetch } from '../../hooks/useAuthFetch'
import { useAuth } from '../../lib/useAuth'
import { getCourseColor } from '../../lib/courseColors'

type Course = { id: string; code?: string | null; name: string; color?: string | null }
type ClassSlot = { course_id: string; code: string | null; name: string; label: string }
type ClassNow = { now: ClassSlot | null; next: ClassSlot | null }
type Recent = {
  recent: { id: string; course_id: string; title: string; preview: string; updated_at: string }[]
  counts: Record<string, number>
}

function when(iso: string) {
  const d = new Date(iso.endsWith('Z') ? iso : `${iso}Z`)
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (days < 1 && new Date().toDateString() === d.toDateString()) return 'Today'
  if (days < 7) return d.toLocaleDateString('en-US', { weekday: 'short' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const notesHref = (courseId: string, extra = '') => `/courses/${courseId}?tab=notes${extra}`

/** Notebook: every class's notes in one place (same as the iPhone app's Notebook tab). Opens straight
 *  to today's class while it's on, using the meeting times from the syllabus. Replaces Chat. */
export default function NotebookPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { fetchWithAuth } = useAuthFetch()
  const [courses, setCourses] = useState<Course[] | null>(null)
  const [notes, setNotes] = useState<Recent | null>(null)
  const [classNow, setClassNow] = useState<ClassNow | null>(null)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (!user) return
    posthog.capture('notebook_opened', { platform: 'web' })
    const get = async <T,>(path: string): Promise<T | null> => {
      try {
        const res = await fetchWithAuth(`${API_URL}${path}`, { cache: 'no-store' })
        return res.ok ? ((await res.json()) as T) : null
      } catch {
        return null
      }
    }
    get<Course[]>('/courses').then((c) => setCourses(c ?? []))
    get<Recent>('/notes?limit=12').then((n) => setNotes(n ?? { recent: [], counts: {} }))
    get<ClassNow>('/me/class-now').then(setClassNow)
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  if (authLoading || !user) return null

  const list = courses ?? []
  const byId = Object.fromEntries(list.map((c) => [c.id, c]))
  const nowClass = classNow?.now
  const nextClass = classNow?.next
  const suggested = nowClass?.course_id ?? notes?.recent[0]?.course_id ?? list[0]?.id
  const suggestedCourse = suggested ? byId[suggested] : undefined
  const label = (c?: { code?: string | null; name: string }) => (c ? c.code || c.name : '')

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#F5F7FA] to-[#E8EDFB] text-slate-800">
      <div className="mx-auto max-w-2xl px-4 pb-16 pt-8">
        <h1 className="text-3xl font-semibold text-slate-900">Notebook</h1>
        <p className="mt-1 text-sm text-slate-500">Your notes for every class, in one place. Type in class or paste them from anywhere.</p>

        <div className="mt-6">
          {nowClass ? (
            <Link
              href={notesHref(nowClass.course_id, '&new=1')}
              onClick={() => posthog.capture('note_started', { from: 'in_class_card', platform: 'web' })}
              className="block rounded-3xl bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <span className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> In class now · {nowClass.label}
              </span>
              <span className="mt-2 block text-2xl font-bold tracking-tight text-slate-900">{nowClass.code || nowClass.name}</span>
              <span className="mt-3 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-[#3b6ed6]">
                <NotebookPen size={18} /> Take notes for this class
              </span>
            </Link>
          ) : list.length ? (
            <Link
              href={notesHref((suggestedCourse ?? list[0]).id, '&new=1')}
              onClick={() => posthog.capture('note_started', { from: 'quick_start', platform: 'web' })}
              className="flex items-center gap-3 rounded-2xl bg-white px-4 py-4 shadow-sm transition hover:shadow-md"
            >
              <NotebookPen size={18} className="text-slate-400" />
              <span className="flex-1 text-slate-500">Start a note for {label(suggestedCourse ?? list[0])}</span>
              {nextClass ? (
                <span className="text-xs text-slate-400">Next: {nextClass.code || nextClass.name} {nextClass.label.split(' - ')[0]}</span>
              ) : null}
            </Link>
          ) : null}
        </div>

        {courses === null ? (
          <p className="mt-8 text-sm text-slate-500">Loading…</p>
        ) : list.length ? (
          <section className="mt-8">
            <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Your classes</h2>
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
              {list.map((c, i) => {
                const color = getCourseColor(c.id, c.color)
                const n = notes?.counts[c.id] ?? 0
                return (
                  <Link
                    key={c.id}
                    href={notesHref(c.id)}
                    className={`flex items-center gap-3 px-4 py-3.5 transition hover:bg-slate-50 ${i ? 'border-t border-slate-100' : ''}`}
                  >
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color.bg}`} style={color.customStyle?.bg} />
                    <span className="flex-1 truncate text-slate-900">{label(c)}</span>
                    <span className="text-sm text-slate-400">{n === 1 ? '1 note' : `${n} notes`}</span>
                    <ChevronRight size={16} className="text-slate-300" />
                  </Link>
                )
              })}
            </div>
          </section>
        ) : (
          <div className="mt-8 rounded-2xl bg-white p-6 text-center shadow-sm">
            <p className="font-semibold text-slate-800">Add a class first</p>
            <p className="mt-1 text-sm text-slate-500">Connect your LMS or add a course, then take notes for it here.</p>
            <Link href="/courses" className="mt-4 inline-block rounded-lg bg-[#5B8DEF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3b6ed6]">
              Go to Courses
            </Link>
          </div>
        )}

        {notes?.recent.length ? (
          <section className="mt-8">
            <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Recent</h2>
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
              {notes.recent.map((n, i) => (
                <Link
                  key={n.id}
                  href={notesHref(n.course_id, `&note=${n.id}`)}
                  className={`block px-4 py-3 transition hover:bg-slate-50 ${i ? 'border-t border-slate-100' : ''}`}
                >
                  <span className="block truncate font-medium text-slate-900">{n.title || 'Untitled note'}</span>
                  <span className="mt-0.5 block truncate text-sm text-slate-500">
                    {[label(byId[n.course_id]), when(n.updated_at)].filter(Boolean).join(' · ')}
                    {n.preview ? ` · ${n.preview}` : ''}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  )
}
