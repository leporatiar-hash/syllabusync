'use client'

// New-signup intro on the web (mirrors the iOS onboarding): name, school, year, goals, which LMS,
// connect it, a syllabus, then a summary. Only reached from /signup; existing users never see it.
// The web can't sign in to the LMS for the student (browsers block reading another site), so the
// connect step opens their LMS and takes the pasted calendar link.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import posthog from 'posthog-js'
import {
  ArrowLeft, Award, BookOpen, Brain, CalendarClock, CalendarRange, CalendarX2, Check, CircleSlash, ExternalLink,
  FileUp, Flame, Globe, LayoutGrid, Lock, MonitorSmartphone, Palette, PencilLine, Search, Sprout, Sun, Target, Timer, BellOff,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../../lib/useAuth'
import { API_URL, friendlyUploadErrorMessage, useAuthFetch } from '../../hooks/useAuthFetch'
import { promoEndLabel } from '../../lib/pricing'
import { useSubscription } from '../../hooks/useSubscription'

type Step = 'name' | 'school' | 'year' | 'goals' | 'lms' | 'connect' | 'skip' | 'syllabus' | 'ready'
const ORDER: Step[] = ['name', 'school', 'year', 'goals', 'lms', 'connect', 'syllabus', 'ready']
type School = { name: string; domain: string }
type LmsOption = { provider: 'brightspace' | 'canvas'; host: string; name: string; source: string }
type Lms = 'brightspace' | 'canvas' | 'blackboard' | 'other' | 'none'

const YEARS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: 'Freshman', label: 'Freshman', icon: Sprout },
  { value: 'Sophomore', label: 'Sophomore', icon: BookOpen },
  { value: 'Junior', label: 'Junior', icon: Target },
  { value: 'Senior', label: 'Senior', icon: Award },
  { value: 'Graduate', label: 'Grad student', icon: Brain },
  { value: 'Other', label: 'Something else', icon: CalendarRange },
]
const GOALS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: 'deadlines', label: 'I find out about due dates too late', icon: CalendarX2 },
  { value: 'procrastinating', label: 'Deadlines slip through the cracks', icon: CalendarClock },
  { value: 'exams', label: 'I cram, then forget it all', icon: Flame },
  { value: 'understanding', label: 'I read it twice and it doesn’t stick', icon: Brain },
  { value: 'overwhelmed', label: 'Classes + work + life = no time', icon: Timer },
]
const MANUAL_LMS: { value: Lms; label: string; sub?: string; icon: LucideIcon }[] = [
  { value: 'canvas', label: 'Canvas', icon: Palette },
  { value: 'brightspace', label: 'Brightspace', sub: 'D2L', icon: Sun },
  { value: 'blackboard', label: 'Blackboard', icon: LayoutGrid },
  { value: 'other', label: 'Something else', sub: 'Moodle, Google Classroom…', icon: MonitorSmartphone },
  { value: 'none', label: 'My classes don’t use one', icon: CircleSlash },
]

function SchoolLogo({ domain, name, size = 44, wide = false }: { domain?: string | null; name: string; size?: number; wide?: boolean }) {
  const [state, setState] = useState<'loading' | 'ok' | 'none'>(domain ? 'loading' : 'none')
  const initials = name.split(/\s+/).filter((w) => w && !['of', 'the', 'and', 'at'].includes(w.toLowerCase())).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'
  const tile = (
    <div className="flex items-center justify-center rounded-xl bg-[#EEF2FF] font-bold text-[#3B5BDB]" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials}
    </div>
  )
  if (!domain || state === 'none') return tile
  return (
    <div className="relative flex items-center justify-center" style={wide ? { width: 260, height: 72 } : { width: size, height: size }}>
      {state === 'loading' && tile}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${API_URL}/schools/logo?domain=${encodeURIComponent(domain)}&kind=${wide ? 'wide' : 'square'}`}
        alt={`${name} logo`}
        onLoad={() => setState('ok')}
        onError={() => setState('none')}
        className={`absolute inset-0 m-auto max-h-full max-w-full object-contain ${state === 'ok' ? '' : 'opacity-0'} ${wide ? '' : 'rounded-xl border border-slate-200 bg-white p-1'}`}
      />
    </div>
  )
}

function Choice({ icon: Icon, label, sub, selected, onClick }: { icon: LucideIcon; label: string; sub?: string; selected?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-2xl border-2 bg-white p-3.5 text-left transition-all hover:border-[#5B8DEF]/60 ${selected ? 'border-[#5B8DEF] bg-[#F2F6FF] shadow-sm' : 'border-slate-200'}`}
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${selected ? 'bg-[#5B8DEF] text-white' : 'bg-[#EEF2FF] text-[#5B8DEF]'}`}>
        <Icon size={22} />
      </span>
      <span className="flex-1">
        <span className="block text-base font-semibold text-slate-900">{label}</span>
        {sub && <span className="block text-sm text-slate-500">{sub}</span>}
      </span>
      {selected && <Check size={18} className="text-[#5B8DEF]" />}
    </button>
  )
}

function Primary({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#A78BFA] py-3.5 text-base font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:opacity-40 disabled:hover:translate-y-0"
    >
      {children}
    </button>
  )
}

export default function WelcomePage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { fetchWithAuth } = useAuthFetch()
  const { promoUntil } = useSubscription()

  const [step, setStep] = useState<Step>('name')
  const [history, setHistory] = useState<Step[]>([])
  const [firstName, setFirstName] = useState('')
  const [school, setSchool] = useState<School | null>(null)
  const [schoolTyped, setSchoolTyped] = useState('')
  const [suggested, setSuggested] = useState<School | null>(null)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<School[]>([])
  const [year, setYear] = useState('')
  const [goals, setGoals] = useState<string[]>([])
  const [lms, setLms] = useState<Lms | null>(null)
  const [lmsOption, setLmsOption] = useState<LmsOption | null>(null)
  const [options, setOptions] = useState<LmsOption[] | null>(null)
  const [showManual, setShowManual] = useState(false)
  const [asking, setAsking] = useState<'brightspace' | 'canvas' | null>(null)
  const [address, setAddress] = useState('')
  const [feed, setFeed] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [synced, setSynced] = useState<number | null>(null)
  const [uploaded, setUploaded] = useState<{ name: string; deadlines: number }[]>([])
  const [summary, setSummary] = useState<{ courses: number; upcoming: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    posthog.capture('onboarding_step', { step, platform: 'web' })
    window.scrollTo({ top: 0 })
  }, [step])

  useEffect(() => {
    if (!user) return
    fetchWithAuth(`${API_URL}/schools/suggest`).then((r) => (r.ok ? r.json() : null)).then((d) => d?.school && setSuggested(d.school)).catch(() => {})
  }, [user, fetchWithAuth])

  useEffect(() => {
    const term = q.trim()
    if (!term) return
    const t = setTimeout(() => {
      fetchWithAuth(`${API_URL}/schools/search?q=${encodeURIComponent(term)}`).then((r) => (r.ok ? r.json() : [])).then((r) => setResults(r.slice(0, 8))).catch(() => {})
    }, 180)
    return () => clearTimeout(t)
  }, [q, fetchWithAuth])

  const go = (next: Step) => {
    setHistory((h) => [...h, step])
    setError(null)
    setStep(next)
  }
  const back = () => {
    setHistory((h) => {
      const prev = h[h.length - 1]
      if (prev) setStep(prev)
      return h.slice(0, -1)
    })
    setError(null)
  }

  const saveProfile = (extra: Record<string, unknown>) =>
    fetchWithAuth(`${API_URL}/me/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user?.email, ...extra }),
    }).catch(() => {})

  const finish = async () => {
    await fetchWithAuth(`${API_URL}/me/complete-onboarding`, { method: 'POST' }).catch(() => {})
    posthog.capture('onboarding_completed', { platform: 'web', lms: lms ?? null, synced: synced ?? 0, syllabi: uploaded.length })
    router.push('/home')
  }

  const skipAll = async () => {
    posthog.capture('onboarding_skipped', { platform: 'web', at: step })
    await fetchWithAuth(`${API_URL}/me/complete-onboarding`, { method: 'POST' }).catch(() => {})
    router.push('/home')
  }

  // ── school
  const chooseSchool = (s: School | null, typed?: string) => {
    setSchool(s)
    setSchoolTyped(typed ?? '')
    if (!s || s.domain !== school?.domain) { setOptions(null); setLmsOption(null); setLms(null) }
    saveProfile({ full_name: firstName.trim() || null, school_name: s?.name ?? typed ?? null, school_domain: s?.domain })
    go('year')
  }

  // ── LMS detection when the LMS step opens
  useEffect(() => {
    if (step !== 'lms' || options !== null) return
    if (!school) { setOptions([]); return }
    fetchWithAuth(`${API_URL}/schools/lms?domain=${encodeURIComponent(school.domain)}`)
      .then((r) => (r.ok ? r.json() : { options: [] }))
      .then((d) => { setOptions(d.options ?? []); posthog.capture('lms_detected', { domain: school.domain, found: (d.options ?? []).map((o: LmsOption) => o.provider).join(',') || 'none', platform: 'web' }) })
      .catch(() => setOptions([]))
  }, [step, options, school, fetchWithAuth])

  const pickLms = (o: LmsOption) => {
    setLms(o.provider)
    setLmsOption(o)
    saveProfile({ lms_provider: o.provider, lms_host: o.host })
    go('connect')
  }

  const checkAddress = async () => {
    setBusy(true)
    setError(null)
    try {
      const r = await fetchWithAuth(`${API_URL}/schools/lms/identify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: address }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.detail || 'We couldn’t check that address.')
      setAsking(null)
      pickLms(d)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We couldn’t check that address.')
    } finally {
      setBusy(false)
    }
  }

  // ── connect
  const lmsName = lmsOption?.name ?? (lms === 'canvas' ? 'Canvas' : lms === 'brightspace' ? 'Brightspace' : lms === 'blackboard' ? 'Blackboard' : 'your LMS')
  const guide = useMemo(() => {
    if (lmsOption?.provider === 'brightspace') return { url: `https://${lmsOption.host}/d2l/home`, steps: [`Sign in to ${lmsName}`, 'Open Calendar, then Subscribe', 'Copy the link and paste it below'] }
    if (lmsOption?.provider === 'canvas') return { url: `https://${lmsOption.host}/calendar`, steps: ['Sign in to Canvas', 'On the Calendar page, click Calendar Feed (bottom right)', 'Copy the link and paste it below'] }
    if (lms === 'blackboard') return { url: '', steps: ['Sign in to Blackboard', 'Calendar, then the settings gear, then Share Calendar', 'Copy the link and paste it below'] }
    return { url: '', steps: [`Sign in to ${lmsName}`, 'Find the calendar’s Subscribe or Export option', 'Copy the link and paste it below'] }
  }, [lmsOption, lms, lmsName])

  const connectFeed = async () => {
    const link = feed.trim().replace(/^webcal:\/\//i, 'https://')
    if (!/^https?:\/\/\S+$/i.test(link)) { setError('That doesn’t look like a link. It usually ends in .ics.'); return }
    setBusy(true)
    setError(null)
    try {
      const r = await fetchWithAuth(`${API_URL}/lms/connect/ical`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ical_url: link }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok && !/already connected/i.test(d.detail || '')) throw new Error(d.detail || 'That link didn’t work.')
      setSynced(d.initial_sync?.synced_count ?? 0)
      posthog.capture('lms_connected', { provider: 'ical', lms: lms ?? null, method: 'paste', platform: 'web' })
      if (school && lmsOption) {
        fetchWithAuth(`${API_URL}/schools/lms/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ domain: school.domain, provider: lmsOption.provider, host: lmsOption.host }) }).catch(() => {})
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That link didn’t work.')
    } finally {
      setBusy(false)
    }
  }

  // ── syllabus
  const uploadSyllabus = async (file: File) => {
    setBusy(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetchWithAuth(`${API_URL}/upload`, { method: 'POST', body: formData, cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || 'Failed to process syllabus')
      if (!data.course) throw new Error(data.debug?.message || 'We couldn’t read that file. Try a PDF with selectable text.')
      const n = typeof data.deadlines_added === 'number' ? data.deadlines_added : (data.deadlines?.length ?? 0)
      setUploaded((u) => [...u, { name: data.course.code || data.course.name || 'Course', deadlines: n }])
      posthog.capture('syllabus_uploaded', { source: 'onboarding', platform: 'web', deadlines: n })
    } catch (e) {
      setError(friendlyUploadErrorMessage(e))
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // ── summary
  useEffect(() => {
    if (step !== 'ready' || summary) return
    const today = new Date()
    const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const to = new Date(today.getTime() + 30 * 86400000)
    Promise.all([
      fetchWithAuth(`${API_URL}/courses`).then((r) => (r.ok ? r.json() : [])),
      fetchWithAuth(`${API_URL}/deadlines?from=${ymd(today)}&to=${ymd(to)}`).then((r) => (r.ok ? r.json() : [])),
    ]).then(([courses, deadlines]) => setSummary({
      courses: Array.isArray(courses) ? courses.length : 0,
      upcoming: Array.isArray(deadlines) ? deadlines.filter((d: { completed?: boolean }) => !d.completed).length : 0,
    })).catch(() => setSummary({ courses: 0, upcoming: 0 }))
  }, [step, summary, fetchWithAuth])

  if (authLoading || !user) {
    return <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-[#5B8DEF] border-t-transparent" /></main>
  }

  const idx = Math.max(0, ORDER.indexOf(step === 'skip' ? 'connect' : step))
  const term = q.trim()
  const schoolName = school?.name ?? schoolTyped

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-white via-[#F8FAFF] to-[#EEF2FF] px-4 pb-16 pt-6">
      <div className="mx-auto max-w-lg">
        <div className="flex items-center gap-3">
          <button type="button" onClick={back} disabled={!history.length} aria-label="Back" className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 disabled:opacity-0">
            <ArrowLeft size={18} />
          </button>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#A78BFA] transition-all duration-500" style={{ width: `${((idx + 1) / ORDER.length) * 100}%` }} />
          </div>
          {step !== 'ready' && <button type="button" onClick={skipAll} className="text-sm font-medium text-slate-400 hover:text-slate-600">Skip setup</button>}
        </div>

        <div className="mt-10 space-y-3">
          {step === 'name' && (
            <>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">First, what&apos;s your name?</h1>
              <input
                autoFocus
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && firstName.trim()) { saveProfile({ full_name: firstName.trim() }); go('school') } }}
                placeholder="First name"
                className="mt-4 w-full rounded-2xl border-2 border-slate-200 bg-white px-5 py-4 text-2xl font-semibold text-slate-900 outline-none focus:border-[#5B8DEF]"
              />
              <div className="pt-6"><Primary disabled={!firstName.trim()} onClick={() => { saveProfile({ full_name: firstName.trim() }); go('school') }}>Next</Primary></div>
            </>
          )}

          {step === 'school' && (
            <>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">{firstName.trim() ? `Hey ${firstName.trim()}. Where do you go?` : 'Where do you go?'}</h1>
              {!suggested && <p className="text-slate-500">Search by name or abbreviation, like CofC or UGA.</p>}
              {suggested && !term && (
                <div className="pt-2">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">From your email</p>
                  <button type="button" onClick={() => chooseSchool(suggested)} className="flex w-full flex-col items-center gap-3 rounded-3xl border-2 border-slate-200 bg-white px-6 py-7 shadow-sm transition-all hover:border-[#5B8DEF]/60">
                    <SchoolLogo domain={suggested.domain} name={suggested.name} wide />
                    <span className="text-xl font-bold text-slate-900">{suggested.name}</span>
                    <span className="rounded-full bg-[#5B8DEF] px-5 py-2 text-sm font-semibold text-white">That&apos;s me</span>
                  </button>
                  <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-slate-400">Or search</p>
                </div>
              )}
              <div className={`flex items-center gap-3 rounded-2xl border-2 bg-white px-4 ${term ? 'border-[#5B8DEF]' : 'border-slate-200'}`}>
                <Search size={18} className={term ? 'text-[#5B8DEF]' : 'text-slate-400'} />
                <input autoFocus={!suggested} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Your school" className="w-full bg-transparent py-3.5 text-lg font-medium text-slate-900 outline-none" />
              </div>
              {term && (
                <div className="space-y-2 pt-1">
                  {results.map((s) => (
                    <button key={s.domain} type="button" onClick={() => chooseSchool(s)} className="flex w-full items-center gap-3 rounded-2xl border-2 border-transparent bg-white p-3 text-left shadow-sm transition-all hover:border-[#5B8DEF]/60">
                      <SchoolLogo domain={s.domain} name={s.name} />
                      <span className="flex-1">
                        <span className="block font-semibold text-slate-900">{s.name}</span>
                        <span className="block text-sm text-slate-400">{s.domain}</span>
                      </span>
                    </button>
                  ))}
                  {!results.some((s) => s.name.toLowerCase() === term.toLowerCase()) && (
                    <button type="button" onClick={() => chooseSchool(null, term)} className="w-full py-3 text-center text-sm text-slate-500">
                      {results.length ? 'Not here? ' : 'No matches. '}<span className="font-semibold text-[#5B8DEF]">Use “{term}”</span>
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {step === 'year' && (
            <>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">What year are you?</h1>
              <div className="grid grid-cols-2 gap-3 pt-4">
                {YEARS.map((y) => (
                  <button
                    key={y.value}
                    type="button"
                    onClick={() => { setYear(y.value); saveProfile({ academic_year: y.value === 'Other' ? null : y.value, school_type: y.value === 'Graduate' ? 'Graduate School' : 'University' }); go('goals') }}
                    className={`flex min-h-[104px] flex-col items-start gap-2 rounded-2xl border-2 bg-white p-4 text-left transition-all hover:border-[#5B8DEF]/60 ${year === y.value ? 'border-[#5B8DEF] bg-[#F2F6FF]' : 'border-slate-200'}`}
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#5B8DEF]"><y.icon size={20} /></span>
                    <span className="font-semibold text-slate-900">{y.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 'goals' && (
            <>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Which of these is you?</h1>
              <p className="text-slate-500">Pick all that apply.</p>
              <div className="space-y-2.5 pt-2">
                {GOALS.map((g) => (
                  <Choice key={g.value} icon={g.icon} label={g.label} selected={goals.includes(g.value)} onClick={() => setGoals((cur) => (cur.includes(g.value) ? cur.filter((x) => x !== g.value) : [...cur, g.value]))} />
                ))}
              </div>
              <div className="pt-4"><Primary disabled={!goals.length} onClick={() => { posthog.capture('onboarding_goals', { goals, platform: 'web' }); go('lms') }}>Next</Primary></div>
            </>
          )}

          {step === 'lms' && options === null && (
            <div className="flex flex-col items-center gap-4 py-16">
              <SchoolLogo domain={school?.domain} name={schoolName || 'School'} size={64} />
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#5B8DEF] border-t-transparent" />
              <p className="font-semibold text-slate-700">Finding {schoolName || 'your school'}&apos;s LMS…</p>
            </div>
          )}

          {step === 'lms' && options !== null && asking && (
            <>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Where do you sign in to {asking === 'canvas' ? 'Canvas' : 'Brightspace'}?</h1>
              <p className="text-slate-500">The web address you go to for your classes. We&apos;ll check it.</p>
              <div className={`mt-2 flex items-center gap-3 rounded-2xl border-2 bg-white px-4 ${error ? 'border-red-400' : 'border-[#5B8DEF]'}`}>
                <Globe size={18} className="text-slate-400" />
                <input autoFocus value={address} onChange={(e) => { setAddress(e.target.value); setError(null) }} onKeyDown={(e) => e.key === 'Enter' && address.trim() && checkAddress()}
                  placeholder={asking === 'canvas' ? 'canvas.school.edu or school.instructure.com' : 'd2l.school.edu or school.brightspace.com'} className="w-full bg-transparent py-3.5 text-base text-slate-900 outline-none" />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="pt-4"><Primary disabled={!address.trim() || busy} onClick={checkAddress}>{busy ? 'Checking…' : 'Continue'}</Primary></div>
              <div className="flex justify-between pt-2 text-sm">
                <button type="button" onClick={() => setAsking(null)} className="font-medium text-slate-500">Pick a different LMS</button>
                <button type="button" onClick={() => { setLms(asking); setLmsOption(null); setAsking(null); go('connect') }} className="font-medium text-slate-500">I don&apos;t know</button>
              </div>
            </>
          )}

          {step === 'lms' && options !== null && !asking && options[0] && !showManual && (
            <>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Found your LMS</h1>
              <div className="mt-4 flex flex-col items-center gap-3 rounded-3xl bg-white px-6 py-8 shadow-sm">
                <SchoolLogo domain={school?.domain} name={schoolName || options[0].name} wide />
                <span className="text-sm text-slate-500">{schoolName}</span>
                <span className="text-2xl font-bold text-slate-900">{options[0].name}</span>
                <span className="flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1 text-sm text-slate-500"><Lock size={12} />{options[0].host}</span>
              </div>
              <div className="pt-4"><Primary onClick={() => pickLms(options[0])}>Yes, connect {options[0].name}</Primary></div>
              {options[1] && <button type="button" onClick={() => pickLms(options[1])} className="w-full py-2 text-center text-sm text-slate-500">We use <span className="font-semibold text-[#5B8DEF]">{options[1].name}</span> instead</button>}
              <button type="button" onClick={() => setShowManual(true)} className="w-full py-2 text-center text-sm font-semibold text-slate-500">That&apos;s not it</button>
            </>
          )}

          {step === 'lms' && options !== null && !asking && (!options[0] || showManual) && (
            <>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Where do your classes live?</h1>
              {school && !options[0] && <p className="text-slate-500">We couldn&apos;t tell what {school.name} uses.</p>}
              <div className="space-y-2.5 pt-2">
                {MANUAL_LMS.map((o) => (
                  <Choice key={o.value} icon={o.icon} label={o.label} sub={o.sub} selected={lms === o.value}
                    onClick={() => {
                      if (o.value === 'canvas' || o.value === 'brightspace') { setAsking(o.value); return }
                      setLms(o.value); setLmsOption(null)
                      if (o.value === 'none') { posthog.capture('onboarding_lms_skipped', { reason: 'no_lms', platform: 'web' }); go('syllabus') } else go('connect')
                    }} />
                ))}
              </div>
            </>
          )}

          {step === 'connect' && synced === null && (
            <>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Connect {lmsName}</h1>
              <p className="text-slate-500">Every assignment and due date, kept up to date when professors change them. Read-only.</p>
              <div className="mt-2 space-y-3 rounded-3xl bg-white p-5 shadow-sm">
                {guide.steps.map((s, i) => (
                  <div key={s} className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EEF2FF] text-sm font-bold text-[#5B8DEF]">{i + 1}</span>
                    <span className="font-medium text-slate-800">{s}</span>
                  </div>
                ))}
                {guide.url && (
                  <a href={guide.url} target="_blank" rel="noopener noreferrer" onClick={() => posthog.capture('onboarding_lms_opened', { lms: lms ?? null, platform: 'web' })}
                    className="mt-1 inline-flex items-center gap-2 rounded-full border-2 border-[#5B8DEF] px-4 py-2 text-sm font-semibold text-[#5B8DEF] hover:bg-[#5B8DEF] hover:text-white">
                    Open {lmsName} <ExternalLink size={14} />
                  </a>
                )}
              </div>
              <input value={feed} onChange={(e) => { setFeed(e.target.value); setError(null) }} onKeyDown={(e) => e.key === 'Enter' && feed.trim() && connectFeed()}
                placeholder="Paste your calendar link here" className="mt-2 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3.5 text-base outline-none focus:border-[#5B8DEF]" />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="pt-3"><Primary disabled={!feed.trim() || busy} onClick={connectFeed}>{busy ? 'Connecting…' : `Connect ${lmsName}`}</Primary></div>
              <button type="button" onClick={() => { posthog.capture('onboarding_lms_skip_tapped', { lms: lms ?? null, platform: 'web' }); go('skip') }} className="w-full py-2 text-center text-sm font-semibold text-slate-500">Skip for now</button>
            </>
          )}

          {step === 'connect' && synced !== null && (
            <>
              <div className="flex flex-col items-center gap-2 rounded-3xl bg-white px-6 py-10 text-center shadow-sm">
                <span className="mb-2 flex h-20 w-20 items-center justify-center rounded-full bg-green-100"><Check size={40} className="text-green-600" strokeWidth={3} /></span>
                <span className="text-3xl font-bold text-slate-900">{lmsName} is connected</span>
                <span className="text-slate-500">{synced ? `${synced} due dates pulled in. ` : ''}New ones show up on their own.</span>
                <span className="mt-2 flex items-center gap-1.5 text-sm text-slate-400"><Lock size={12} />Read-only. ClassMate never changes anything in {lmsName}.</span>
              </div>
              <div className="pt-4"><Primary onClick={() => go('syllabus')}>Continue</Primary></div>
            </>
          )}

          {step === 'skip' && (
            <>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Skip {lmsName}?</h1>
              <p className="text-slate-500">It takes about a minute, and you only do it once.</p>
              <div className="mt-2 space-y-4 rounded-3xl bg-white p-5 shadow-sm">
                {[{ icon: CalendarX2, t: 'When a professor moves a due date, you won’t hear about it.' }, { icon: PencilLine, t: 'Every assignment gets typed in by hand.' }, { icon: BellOff, t: `No reminders for anything posted in ${lmsName}.` }].map(({ icon: Icon, t }) => (
                  <div key={t} className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-500"><Icon size={18} /></span>
                    <span className="font-medium text-slate-800">{t}</span>
                  </div>
                ))}
              </div>
              <div className="pt-4"><Primary onClick={() => { posthog.capture('onboarding_lms_skip_reversed', { platform: 'web' }); back() }}>Connect {lmsName}</Primary></div>
              <button type="button" onClick={() => { posthog.capture('onboarding_lms_skipped', { reason: 'confirmed', platform: 'web' }); go('syllabus') }} className="w-full py-2 text-center text-sm font-semibold text-slate-500">Skip anyway</button>
            </>
          )}

          {step === 'syllabus' && (
            <>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">{uploaded.length ? 'Nice. Add another?' : synced !== null ? 'Now add a syllabus' : 'Drop in a syllabus'}</h1>
              <p className="text-slate-500">
                {synced !== null ? `Professor emails, office hours and grading policies. Due dates keep coming from ${lmsName}.` : 'We’ll pull out every exam and assignment.'}
              </p>
              {uploaded.map((u, i) => (
                <div key={i} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100"><Check size={20} className="text-green-600" strokeWidth={3} /></span>
                  <span className="flex-1">
                    <span className="block font-semibold text-slate-900">{u.name}</span>
                    <span className="block text-sm text-slate-500">{synced !== null ? 'Course info saved' : `${u.deadlines} deadline${u.deadlines === 1 ? '' : 's'} added`}</span>
                  </span>
                </div>
              ))}
              <input ref={fileRef} type="file" accept=".pdf,.docx" className="hidden" onChange={(e) => e.target.files?.[0] && uploadSyllabus(e.target.files[0])} />
              <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}
                className={`flex w-full flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-[#C7D2FE] bg-white transition-colors hover:bg-[#F5F7FF] ${uploaded.length ? 'py-6' : 'py-14'}`}>
                {busy ? (
                  <>
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#5B8DEF] border-t-transparent" />
                    <span className="font-semibold text-slate-800">Reading your syllabus…</span>
                    <span className="text-sm text-slate-400">About 30 seconds</span>
                  </>
                ) : (
                  <>
                    <FileUp size={28} className="text-[#5B8DEF]" />
                    <span className="font-semibold text-slate-800">{uploaded.length ? 'Add another syllabus' : 'Choose a syllabus (PDF or Word)'}</span>
                  </>
                )}
              </button>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="pt-3"><Primary onClick={() => { if (!uploaded.length) posthog.capture('onboarding_syllabus_skipped', { platform: 'web' }); go('ready') }}>{uploaded.length ? 'See my semester' : 'Skip for now'}</Primary></div>
            </>
          )}

          {step === 'ready' && (
            <>
              <div className="rounded-3xl bg-gradient-to-br from-[#5B8DEF] to-[#A78BFA] px-6 py-10 text-center text-white shadow-md">
                <p className="text-sm font-semibold uppercase tracking-widest text-white/80">You&apos;re all set{firstName.trim() ? `, ${firstName.trim()}` : ''}</p>
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div><div className="text-5xl font-bold">{summary ? summary.courses : '…'}</div><div className="mt-1 text-white/85">courses</div></div>
                  <div><div className="text-5xl font-bold">{summary ? summary.upcoming : '…'}</div><div className="mt-1 text-white/85">due in the next 30 days</div></div>
                </div>
                {promoUntil && <p className="mt-6 text-sm text-white/90">ClassMate Pro is free for everyone through {promoEndLabel(promoUntil)}. No card needed.</p>}
              </div>
              <div className="pt-4"><Primary onClick={finish}>Go to my dashboard</Primary></div>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
