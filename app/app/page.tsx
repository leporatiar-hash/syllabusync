'use client'

import { useEffect, useState, ReactNode } from 'react'
import Link from 'next/link'
import { BookOpen, HelpCircle, FileText, Target, BookMarked, ClipboardList, Calendar } from 'lucide-react'
import { API_URL, authFetch } from './hooks/useAuthFetch'
import { useAuth } from './context/AuthContext'

interface Deadline {
  id: string
  deadline_id: string
  course_name: string
  course_code?: string
  date: string
  time?: string
  type: string
  title: string
}

const typeStyles: Record<string, { bg: string; text: string; icon: ReactNode }> = {
  Exam: { bg: 'bg-[#FEE2E2]', text: 'text-[#FB7185]', icon: <BookOpen size={16} /> },
  Quiz: { bg: 'bg-[#FFEDD5]', text: 'text-[#FB923C]', icon: <HelpCircle size={16} /> },
  Assignment: { bg: 'bg-[#E0F2FE]', text: 'text-[#38BDF8]', icon: <FileText size={16} /> },
  Project: { bg: 'bg-[#F3E8FF]', text: 'text-[#A78BFA]', icon: <Target size={16} /> },
  Homework: { bg: 'bg-[#DCFCE7]', text: 'text-[#4ADE80]', icon: <BookMarked size={16} /> },
  Admin: { bg: 'bg-slate-100', text: 'text-slate-600', icon: <ClipboardList size={16} /> },
}

const features = [
  {
    title: 'Parse Syllabi',
    description: 'Upload and extract deadlines in seconds with AI-powered parsing.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M8 7h8M8 11h8M8 15h5" />
        <rect x="5" y="3" width="14" height="18" rx="3" />
      </svg>
    ),
  },
  {
    title: 'Study Smart',
    description: 'Generate flashcards from your materials and review efficiently.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M4 7h12a3 3 0 0 1 3 3v7" />
        <path d="M7 4h10a3 3 0 0 1 3 3v10" />
        <rect x="4" y="7" width="12" height="12" rx="3" />
      </svg>
    ),
  },
  {
    title: 'Stay Organized',
    description: 'See all deadlines at a glance with a calendar view.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="3" y="4" width="18" height="17" rx="3" />
        <path d="M8 2v4M16 2v4M3 10h18" />
      </svg>
    ),
  },
]

export default function HomePage() {
  const { token, login } = useAuth()
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)

  useEffect(() => {
    const loadDeadlines = async () => {
      try {
        const res = await authFetch(`${API_URL}/calendar-entries`, { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          // Filter to only show upcoming deadlines (today or future)
          const today = new Date().toISOString().split('T')[0]
          const upcoming = data
            .filter((d: Deadline) => d.date >= today)
            .sort((a: Deadline, b: Deadline) => a.date.localeCompare(b.date))
            .slice(0, 5)
          setDeadlines(upcoming)
        }
      } catch (err) {
        console.error('Failed to load deadlines:', err)
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      loadDeadlines()
    } else {
      setLoading(false)
    }
  }, [token])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const handleInlineLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    setLoggingIn(true)
    try {
      await login(email)
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoggingIn(false)
    }
  }

  if (!token) {
    return (
      <main className="min-h-screen">
        <section className="relative overflow-hidden bg-gradient-to-br from-[#EEF2FF] via-[#F9F5FF] to-[#ECFEFF]">
          <div className="absolute inset-0 opacity-40">
            <div className="absolute -left-20 top-24 h-56 w-56 rounded-full bg-[#5B8DEF]/30 blur-3xl" />
            <div className="absolute right-10 top-10 h-64 w-64 rounded-full bg-[#A78BFA]/30 blur-3xl" />
            <div className="absolute bottom-0 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-[#38BDF8]/20 blur-3xl" />
          </div>
          <div className="relative mx-auto flex max-w-6xl flex-col gap-10 px-4 py-20 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <p className="mb-4 inline-flex items-center rounded-full bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#5B8DEF] shadow-sm">
                Your academic companion
              </p>
              <h1 className="text-4xl font-semibold leading-tight text-slate-900 md:text-5xl">
                Welcome to ClassMate
              </h1>
              <p className="mt-4 text-lg text-slate-600">
                A calm, organized workspace for students to parse syllabi, track deadlines, and build study momentum.
              </p>
            </div>
            <div className="w-full max-w-md rounded-3xl border border-white/60 bg-white/80 p-6 shadow-lg backdrop-blur">
              <h2 className="text-lg font-semibold text-slate-900">Enter your .edu email</h2>
              <p className="mt-1 text-sm text-slate-500">Start your private workspace in seconds.</p>
              <form onSubmit={handleInlineLogin} className="mt-4 space-y-3">
                {loginError && (
                  <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
                    {loginError}
                  </div>
                )}
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition-colors focus:border-[#5B8DEF] focus:ring-2 focus:ring-[#5B8DEF]/20"
                  placeholder="you@school.edu"
                />
                <button
                  type="submit"
                  disabled={loggingIn}
                  className="w-full rounded-lg bg-gradient-to-r from-[#5B8DEF] to-[#A78BFA] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {loggingIn ? 'Starting...' : 'Continue'}
                </button>
              </form>
            </div>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen">
      <section className="relative overflow-hidden bg-gradient-to-br from-[#EEF2FF] via-[#F9F5FF] to-[#ECFEFF]">
        <div className="absolute inset-0 opacity-40">
          <div className="absolute -left-20 top-24 h-56 w-56 rounded-full bg-[#5B8DEF]/30 blur-3xl" />
          <div className="absolute right-10 top-10 h-64 w-64 rounded-full bg-[#A78BFA]/30 blur-3xl" />
          <div className="absolute bottom-0 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-[#38BDF8]/20 blur-3xl" />
        </div>
        <div className="relative mx-auto flex max-w-6xl flex-col gap-10 px-4 py-20 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <p className="mb-4 inline-flex items-center rounded-full bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#5B8DEF] shadow-sm">
              Your academic companion
            </p>
            <h1 className="text-4xl font-semibold leading-tight text-slate-900 md:text-5xl">
              Welcome to ClassMate
            </h1>
            <p className="mt-4 text-lg text-slate-600">
              A calm, organized workspace for students to parse syllabi, track deadlines, and build study momentum.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/courses"
                className="rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-8 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
              >
                Get Started
              </Link>
              <Link
                href="/calendar"
                className="rounded-full border border-white/70 bg-white/70 px-8 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
              >
                View Calendar
              </Link>
            </div>
          </div>

          {/* Upcoming Deadlines Panel */}
          <div className="w-full max-w-md rounded-[28px] bg-white/70 p-6 shadow-xl backdrop-blur">
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span className="font-semibold text-slate-700">Upcoming deadlines</span>
              {deadlines.length > 0 && (
                <Link href="/calendar" className="text-xs text-[#5B8DEF] hover:underline">
                  View all →
                </Link>
              )}
            </div>

            <div className="mt-4 space-y-3">
              {loading ? (
                <div className="flex h-32 items-center justify-center text-sm text-slate-400">
                  Loading...
                </div>
              ) : deadlines.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/50 p-8 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <Calendar size={24} />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-700">No upcoming deadlines yet</p>
                  <p className="mt-1 text-xs text-slate-500">Upload a syllabus to get started!</p>
                  <Link
                    href="/courses"
                    className="mt-4 rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-5 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                  >
                    Get Started
                  </Link>
                </div>
              ) : (
                deadlines.map((deadline) => {
                  const style = typeStyles[deadline.type] || typeStyles.Admin
                  return (
                    <div
                      key={deadline.id}
                      className="flex items-center justify-between rounded-2xl border border-white/80 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="flex items-center gap-3">
                        <span className={style.text}>{style.icon}</span>
                        <div>
                          <div className="font-semibold">{deadline.title}</div>
                          <div className="text-xs text-slate-500">
                            {deadline.course_code || deadline.course_name} • {formatDate(deadline.date)}
                            {deadline.time && ` at ${deadline.time}`}
                          </div>
                        </div>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${style.bg} ${style.text}`}>
                        {deadline.type}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-2xl border border-white bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#EEF2FF] to-[#F0FDFF] text-[#5B8DEF]">
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{feature.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
