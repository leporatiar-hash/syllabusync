'use client'

import { useCallback, useEffect, useState, ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { BookOpen, HelpCircle, FileText, Target, BookMarked, ClipboardList, Calendar, Share2, Copy, Check, X, ChevronRight, RefreshCw } from 'lucide-react'
import { API_URL, useAuthFetch } from '../hooks/useAuthFetch'
import { useAuth } from '../lib/useAuth'
import { useSubscription } from '../hooks/useSubscription'
import UpgradePrompt from '../components/UpgradePrompt'
import FoundingMemberPrompt from '../components/FoundingMemberPrompt'
import FeatureDiscoveryPanel from '../components/FeatureDiscoveryPanel'
import ValuePropPrompt from '../components/ValuePropPrompt'
import { decideFoundingPrompt } from '../lib/foundingPrompt'
import { shouldShowValuePrompt } from '../lib/valuePrompt'
import { addDays, formatDeadlineDate, localToday } from '../lib/deadlineGroups'

const CanvasConnectModal = dynamic(() => import('../components/CanvasConnectModal'), { ssr: false })
const ICalConnectModal = dynamic(() => import('../components/ICalConnectModal'), { ssr: false })

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

const gettingStartedItems = [
  {
    key: 'connect_lms',
    label: 'Connect your LMS',
    description: 'Sync your calendar and deadlines automatically',
    href: '/settings',
    cta: 'Go to Settings',
  },
  {
    key: 'add_courses',
    label: 'Add your courses',
    description: 'Create your course list for the semester',
    href: '/courses',
    cta: 'My Courses',
  },
  {
    key: 'upload_syllabus',
    label: 'Upload a syllabus',
    description: 'Let AI extract all deadlines from your syllabus PDF',
    href: '/courses',
    cta: 'Upload Now',
  },
]

// Types arrive in mixed case ("assignment", "Admin"); normalize so badges and styles are consistent.
function normalizeType(type: string): string {
  if (!type) return 'Admin'
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()
}

export default function HomeClient() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { fetchWithAuth } = useAuthFetch()
  const {
    canGenerate,
    isPro,
    aiGenerationsUsed,
    aiGenerationsMax,
    chatMessagesUsed,
    chatMessagesMax,
    upgradePromptDismissedAt,
    dismissUpgradePrompt,
  } = useSubscription()
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [dueThisWeek, setDueThisWeek] = useState(0)
  const [loading, setLoading] = useState(true)
  const [lmsConnections, setLmsConnections] = useState<any[]>([])
  const [lmsLoaded, setLmsLoaded] = useState(false)
  const [courses, setCourses] = useState<any[]>([])
  const [showCanvasModal, setShowCanvasModal] = useState(false)
  const [showICalModal, setShowICalModal] = useState(false)
  const [referralCode, setReferralCode] = useState('')
  const [referralCount, setReferralCount] = useState(0)
  const [copied, setCopied] = useState(false)
  const [showGettingStarted, setShowGettingStarted] = useState(false)
  const [featureUsage, setFeatureUsage] = useState<{ used_study_guide: boolean; used_flashcards: boolean; used_chat: boolean; panel_hidden: boolean } | null>(null)
  const [showValuePrompt, setShowValuePrompt] = useState(false)


  // Show Getting Started checklist unless dismissed
  useEffect(() => {
    if (!user) return
    const dismissed = localStorage.getItem(`getting_started_dismissed_${user.id}`)
    if (!dismissed) setShowGettingStarted(true)
  }, [user])

  const dismissGettingStarted = () => {
    if (user) localStorage.setItem(`getting_started_dismissed_${user.id}`, '1')
    setShowGettingStarted(false)
  }

  const loadLmsConnections = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/lms/connections`)
      if (res.ok) setLmsConnections(await res.json())
    } catch { /* non-fatal */ }
    finally { setLmsLoaded(true) }
  }, [fetchWithAuth])

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [authLoading, user, router])

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    const loadDeadlines = async () => {
      try {
        const res = await fetchWithAuth(`${API_URL}/calendar-entries`, { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          const today = localToday()
          const weekEnd = addDays(today, 6)
          const upcoming = data
            .filter((d: Deadline) => d.date >= today)
            .sort((a: Deadline, b: Deadline) => a.date.localeCompare(b.date))
          setDueThisWeek(upcoming.filter((d: Deadline) => d.date <= weekEnd).length)
          setDeadlines(upcoming.slice(0, 8))
        }
      } catch (err) {
        console.error('Failed to load deadlines:', err)
      } finally {
        setLoading(false)
      }
    }

    loadDeadlines()
  }, [user])

  useEffect(() => {
    if (user) loadLmsConnections()
  }, [user, loadLmsConnections])

  useEffect(() => {
    if (!user) return
    const loadCourses = async () => {
      try {
        const res = await fetchWithAuth(`${API_URL}/courses`)
        if (res.ok) setCourses(await res.json())
      } catch { /* non-fatal */ }
    }
    loadCourses()
  }, [user, fetchWithAuth])

  useEffect(() => {
    if (!user) return
    const loadReferral = async () => {
      try {
        const res = await fetchWithAuth(`${API_URL}/me/referral`)
        if (res.ok) {
          const data = await res.json()
          setReferralCode(data.referral_code)
          setReferralCount(data.referral_count)
        }
      } catch { /* non-fatal */ }
    }
    loadReferral()
  }, [user])

  useEffect(() => {
    if (!user) return
    const loadFeatureUsage = async () => {
      try {
        const res = await fetchWithAuth(`${API_URL}/me/feature-usage`)
        if (res.ok) setFeatureUsage(await res.json())
      } catch { /* non-fatal */ }
    }
    loadFeatureUsage()
  }, [user, fetchWithAuth])

  const hideFeaturePanel = () => {
    setFeatureUsage((prev) => (prev ? { ...prev, panel_hidden: true } : prev)) // optimistic
    fetchWithAuth(`${API_URL}/me/feature-usage/hide-panel`, { method: 'POST' }).catch(() => {})
  }

  // Ping once per browser session (mirrors the chat_proactive_shown pattern) so the
  // one-question value-prop prompt can trigger on 3+ sessions.
  useEffect(() => {
    if (!user) return
    if (typeof sessionStorage === 'undefined') return
    if (sessionStorage.getItem('session_pinged')) return
    sessionStorage.setItem('session_pinged', '1')
    fetchWithAuth(`${API_URL}/me/session-ping`, { method: 'POST' }).catch(() => {})
  }, [user, fetchWithAuth])

  useEffect(() => {
    if (!user) return
    const loadValuePromptStatus = async () => {
      try {
        const res = await fetchWithAuth(`${API_URL}/me/value-prompt-status`)
        if (!res.ok) return
        const data = await res.json()
        setShowValuePrompt(
          shouldShowValuePrompt({
            sessionCount: data.session_count ?? 0,
            accountCreatedAt: data.account_created_at ?? null,
            valuePromptShownAt: data.value_prompt_shown_at ?? null,
          }),
        )
      } catch { /* non-fatal */ }
    }
    loadValuePromptStatus()
  }, [user, fetchWithAuth])

  const submitValuePrompt = (answer: string) => {
    setShowValuePrompt(false) // optimistic — shown at most once regardless of network result
    fetchWithAuth(`${API_URL}/me/value-prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer }),
    }).catch(() => {})
  }

  const skipValuePrompt = () => {
    setShowValuePrompt(false)
    fetchWithAuth(`${API_URL}/me/value-prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: null }),
    }).catch(() => {})
  }

  const referralLink = referralCode ? `https://tryclassmate.com/signup?ref=${referralCode}` : ''

  const hasConnectedLms = lmsConnections.length > 0
  const setupDone: Record<string, boolean> = {
    connect_lms: hasConnectedLms,
    add_courses: courses.length > 0,
    upload_syllabus: courses.some((c) => c.course_info !== null && c.course_info !== undefined),
  }
  const setupCompleteCount = gettingStartedItems.filter((item) => setupDone[item.key]).length
  const setupComplete = setupCompleteCount === gettingStartedItems.length

  // Retire the checklist for good once every step is done (only after LMS state has loaded, so a
  // slow /lms/connections response can't count as "not connected" or vice versa).
  useEffect(() => {
    if (showGettingStarted && lmsLoaded && setupComplete) dismissGettingStarted()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showGettingStarted, lmsLoaded, setupComplete])

  const showFeaturePanel = !!(
    featureUsage &&
    !featureUsage.panel_hidden &&
    !(featureUsage.used_study_guide && featureUsage.used_flashcards && featureUsage.used_chat) &&
    courses.length > 0
  )

  const foundingPromptDecision = lmsLoaded
    ? decideFoundingPrompt({
        isPro,
        hasLmsConnection: lmsConnections.length > 0,
        hasCourses: courses.length > 0,
        aiGenerationsUsed,
        aiGenerationsMax,
        chatMessagesUsed,
        chatMessagesMax,
        upgradePromptDismissedAt,
      })
    : { show: false as const }

  const copyLink = () => {
    if (!referralLink) return
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareLink = () => {
    if (!referralLink) return
    if (navigator.share) {
      navigator.share({ title: 'Join ClassMate', text: 'Check out ClassMate — it helps you stay organized with your courses!', url: referralLink })
    } else {
      copyLink()
    }
  }

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#F5F7FA] to-[#E8EDFB]">
        <div className="text-slate-500">Loading...</div>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-[#F5F7FA] to-[#E8EDFB]">
        <section className="mx-auto flex min-h-[70vh] max-w-6xl flex-col items-center justify-center px-4 py-16 text-center">
          <h1 className="text-4xl font-semibold leading-tight text-slate-900 md:text-5xl">
            Welcome to ClassMate
          </h1>
          <p className="mt-4 max-w-xl text-lg text-slate-600">
            A calm, organized workspace for students to parse syllabi, track deadlines, and build study momentum.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/login"
              className="rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-8 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="rounded-full border border-white/70 bg-white/70 px-8 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
            >
              Sign Up
            </Link>
          </div>
        </section>
      </main>
    )
  }


  const today = localToday()
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const providers = lmsConnections.map((c) => (c.provider === 'canvas' ? 'Canvas' : 'iCal')).join(' & ')

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#F5F7FA] to-[#E8EDFB] text-slate-800">
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-10">
        {!isPro && (
          <div className="mb-8">
            {foundingPromptDecision.show ? (
              <FoundingMemberPrompt reason={foundingPromptDecision.reason} onDismiss={dismissUpgradePrompt} />
            ) : (
              <UpgradePrompt variant="promo" />
            )}
          </div>
        )}

        {/* Header */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{todayLabel}</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900 md:text-4xl">Welcome back</h1>
            {!loading && (
              <p className="mt-2 text-slate-600">
                {dueThisWeek === 0
                  ? 'Nothing due in the next 7 days.'
                  : `You have ${dueThisWeek} ${dueThisWeek === 1 ? 'thing' : 'things'} due in the next 7 days.`}
              </p>
            )}
          </div>
          {lmsLoaded && hasConnectedLms && (
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 self-start rounded-full bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-white sm:self-auto"
              title="Manage connections"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {providers} synced
            </Link>
          )}
        </header>

        {showValuePrompt && (
          <div className="mt-6">
            <ValuePropPrompt onSubmit={submitValuePrompt} onSkip={skipValuePrompt} />
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {/* Upcoming deadlines — the main thing students come here for */}
          <section className="rounded-2xl border border-white bg-white p-6 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Upcoming deadlines</h2>
              {deadlines.length > 0 && (
                <Link href="/calendar" className="text-sm font-medium text-[#5B8DEF] hover:underline">
                  View calendar →
                </Link>
              )}
            </div>

            {loading ? (
              <div className="flex h-48 items-center justify-center text-sm text-slate-400">Loading...</div>
            ) : deadlines.length === 0 ? (
              <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 p-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <Calendar size={24} />
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-700">No upcoming deadlines yet</p>
                <p className="mt-1 text-xs text-slate-500">Upload a syllabus and we&apos;ll pull out every due date.</p>
                <Link
                  href="/courses"
                  className="mt-4 rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-5 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                >
                  Go to My Courses
                </Link>
              </div>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {deadlines.map((deadline) => {
                  const type = normalizeType(deadline.type)
                  const style = typeStyles[type] || typeStyles.Admin
                  const dateLabel = formatDeadlineDate(deadline.date, today, 'en-US')
                  const soon = dateLabel === 'Today' || dateLabel === 'Tomorrow'
                  return (
                    <li key={deadline.id} className="flex items-center gap-4 py-3">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${style.bg} ${style.text}`}>
                        {style.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800" title={deadline.title}>
                          {deadline.title}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {deadline.course_code || deadline.course_name}
                          <span className="hidden sm:inline"> · {type}</span>
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={`text-sm ${soon ? 'font-semibold text-[#FB7185]' : 'font-medium text-slate-700'}`}>
                          {dateLabel}
                        </p>
                        {deadline.time && <p className="text-xs text-slate-400">{deadline.time}</p>}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* Sidebar */}
          <aside className="space-y-6">
            {showGettingStarted && lmsLoaded && !setupComplete && (
              <div className="rounded-2xl border border-white bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">Finish setting up</h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {setupCompleteCount} of {gettingStartedItems.length} done
                    </p>
                  </div>
                  <button
                    onClick={dismissGettingStarted}
                    className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    aria-label="Dismiss"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] transition-all"
                    style={{ width: `${(setupCompleteCount / gettingStartedItems.length) * 100}%` }}
                  />
                </div>
                <ul className="mt-3 -mx-2">
                  {gettingStartedItems.map((item) => {
                    const done = setupDone[item.key]
                    const icon = done ? (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500">
                        <Check size={12} strokeWidth={3} className="text-white" />
                      </span>
                    ) : (
                      <span className="h-5 w-5 shrink-0 rounded-full border-2 border-slate-300" />
                    )
                    if (done) {
                      return (
                        <li key={item.key} className="flex items-center gap-3 px-2 py-2">
                          {icon}
                          <span className="text-sm text-slate-400 line-through">{item.label}</span>
                        </li>
                      )
                    }
                    return (
                      <li key={item.key}>
                        <Link
                          href={item.href}
                          className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-slate-50"
                        >
                          {icon}
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-slate-800">{item.label}</span>
                            <span className="block text-xs text-slate-500">{item.description}</span>
                          </span>
                          <ChevronRight size={16} className="shrink-0 text-slate-300 group-hover:text-slate-500" />
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {lmsLoaded && !hasConnectedLms && (
              <div className="rounded-2xl border border-white bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#EEF2FF] to-[#F0FDFF] text-[#5B8DEF]">
                    <RefreshCw size={16} />
                  </span>
                  <h2 className="text-sm font-semibold text-slate-900">Sync your school calendar</h2>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Import assignments from Canvas or an iCal feed. Upload syllabi first so deadlines match your courses.
                </p>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setShowCanvasModal(true)}
                    className="flex-1 rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:shadow-md"
                  >
                    Connect Canvas
                  </button>
                  <button
                    onClick={() => setShowICalModal(true)}
                    className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    iCal feed
                  </button>
                </div>
              </div>
            )}

            {showFeaturePanel && (
              <FeatureDiscoveryPanel latestCourseId={courses[0].id} onHide={hideFeaturePanel} />
            )}

            {referralCode && (
              <div className="rounded-2xl border border-white bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <Share2 size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-semibold text-slate-900">Share with friends</h2>
                    {referralCount > 0 && <p className="text-xs text-slate-500">{referralCount} joined</p>}
                  </div>
                  <button
                    onClick={copyLink}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50"
                    title="Copy link"
                    aria-label="Copy link"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                  <button
                    onClick={shareLink}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    Share
                  </button>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {showCanvasModal && (
        <CanvasConnectModal
          onClose={() => setShowCanvasModal(false)}
          onSuccess={() => { setShowCanvasModal(false); loadLmsConnections() }}
        />
      )}
      {showICalModal && (
        <ICalConnectModal
          onClose={() => setShowICalModal(false)}
          onSuccess={() => { setShowICalModal(false); loadLmsConnections() }}
        />
      )}
    </main>
  )
}
