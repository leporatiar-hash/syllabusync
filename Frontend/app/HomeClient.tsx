'use client'

import { useCallback, useEffect, useState, ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { BookOpen, HelpCircle, FileText, Target, BookMarked, ClipboardList, Calendar, Share2, Copy, Check } from 'lucide-react'
import { API_URL, useAuthFetch } from '../hooks/useAuthFetch'
import { useAuth } from '../lib/useAuth'
import { useSubscription } from '../hooks/useSubscription'
import UpgradePrompt from '../components/UpgradePrompt'

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

const features = [
  {
    title: 'Parse Syllabi',
    description: 'Upload and extract deadlines in seconds with AI-powered parsing.',
    href: '/courses',
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
    href: '/study-studio',
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
    href: '/calendar',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="3" y="4" width="18" height="17" rx="3" />
        <path d="M8 2v4M16 2v4M3 10h18" />
      </svg>
    ),
  },
]

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function HomeClient() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { fetchWithAuth } = useAuthFetch()
  const { canGenerate, isPro } = useSubscription()
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [loading, setLoading] = useState(true)
  const [lmsConnections, setLmsConnections] = useState<any[]>([])
  const [lmsLoaded, setLmsLoaded] = useState(false)
  const [showCanvasModal, setShowCanvasModal] = useState(false)
  const [showICalModal, setShowICalModal] = useState(false)
  const [referralCode, setReferralCode] = useState('')
  const [referralCount, setReferralCount] = useState(0)
  const [copied, setCopied] = useState(false)
  // Check if user needs onboarding
  useEffect(() => {
    if (!user) return
    const checkOnboarding = async () => {
      try {
        const res = await fetchWithAuth(`${API_URL}/me`)
        if (res.ok) {
          const data = await res.json()
          if (!data.has_completed_onboarding) {
            router.replace('/onboarding')
          }
        }
      } catch {
        // non-fatal — let them through
      }
    }
    checkOnboarding()
  }, [user, fetchWithAuth, router])

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

    loadDeadlines()
  }, [user])

  useEffect(() => {
    if (user) loadLmsConnections()
  }, [user, loadLmsConnections])

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

  const referralLink = referralCode ? `https://tryclassmate.com/signup?ref=${referralCode}` : ''

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

  // Show loading while checking auth
  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#F5F7FA] to-[#E8EDFB]">
        <div className="text-slate-500">Loading...</div>
      </main>
    )
  }

  // If not logged in, show landing page while redirecting
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

  // Logged in - show dashboard
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#F5F7FA] to-[#E8EDFB] text-slate-800">
      {!isPro && (
        <div className="mx-auto max-w-6xl px-4 pt-8">
          <UpgradePrompt variant="promo" />
        </div>
      )}
      <section className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-16 md:flex-row md:items-start md:justify-between">
        <div className="flex-1 space-y-4">
          <h1 className="text-4xl font-semibold leading-tight text-slate-900 md:text-5xl">
            Welcome back!
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            A calm, organized workspace for students to parse syllabi, track deadlines, and build study momentum.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/courses"
              className="rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-8 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
            >
              My Courses
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
                  Add a Course
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
      </section>

      {/* LMS Connect Banner — only shown when no connections yet */}
      {lmsLoaded && lmsConnections.length === 0 && (
        <section className="mx-auto max-w-6xl px-4">
          <div className="rounded-2xl border border-white bg-white p-6 shadow-sm">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#EEF2FF] to-[#F0FDFF] text-[#5B8DEF]">
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Sync your school calendar</h3>
                  <p className="text-sm text-slate-500">
                    Connect your Canvas or iCal feed to automatically import all your assignments and due dates.
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Tip: Upload your syllabi first so deadlines get matched to your courses.
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-3">
                <button
                  onClick={() => setShowCanvasModal(true)}
                  className="rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
                >
                  Connect Canvas
                </button>
                <button
                  onClick={() => setShowICalModal(true)}
                  className="rounded-full border border-white/70 bg-white/70 px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                >
                  iCal Feed
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* LMS Connected Banner — shown when connections exist */}
      {lmsLoaded && lmsConnections.length > 0 && (
        <section className="mx-auto max-w-6xl px-4">
          <div className="rounded-2xl border border-white bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-green-50 text-green-500">
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Calendar synced</h3>
                  <p className="text-sm text-slate-500">
                    {lmsConnections.map(c => c.provider === 'canvas' ? 'Canvas' : 'iCal').join(' & ')} connected.
                    Your deadlines are up to date.{' '}
                    <Link href="/settings" className="font-medium text-[#5B8DEF] hover:underline">Manage connections</Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

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

      {/* Share ClassMate Card - Compact */}
      {referralCode && (
        <section className="mx-auto max-w-6xl px-4 pt-6">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <Share2 size={16} />
                </div>
                <div>
                  <span className="text-sm font-medium text-slate-700">Share with friends</span>
                  {referralCount > 0 && (
                    <span className="ml-2 text-xs text-slate-500">
                      {referralCount} joined
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <div className="hidden sm:flex items-center rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-500">
                  <span className="max-w-[140px] truncate">{referralLink}</span>
                </div>
                <button
                  onClick={copyLink}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50"
                  title="Copy link"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
                <button
                  onClick={shareLink}
                  className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Share
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((feature) => (
            <Link
              key={feature.title}
              href={feature.href}
              className="group rounded-2xl border border-white bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#EEF2FF] to-[#F0FDFF] text-[#5B8DEF]">
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{feature.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{feature.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
