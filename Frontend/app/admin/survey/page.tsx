'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../../lib/useAuth'
import { API_URL, useAuthFetch } from '../../../hooks/useAuthFetch'

// Founder-only view of the feedback survey (components/FeedbackSurvey.tsx). The backend
// (/admin/survey-responses) refuses everyone except ADMIN_EMAILS, so this page shows nothing to others.

type Answers = {
  disappointed?: string
  uses?: string[]
  heard?: string
  missing?: string
  call?: string
  contact?: string | null
}
type Response = { email: string | null; at: string | null; answers: Answers }
type Results = { survey_key: string; answered: number; dismissed: number; responses: Response[] }

const DISAPPOINTED_LABEL: Record<string, string> = {
  very: 'Very disappointed',
  somewhat: 'Somewhat disappointed',
  not: 'Not disappointed',
}

function tally(values: (string | undefined)[]) {
  const counts = new Map<string, number>()
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}

function Bars({ title, rows, total }: { title: string; rows: [string, number][]; total: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">No answers yet</p>
      ) : (
        <ul className="space-y-2">
          {rows.map(([label, n]) => (
            <li key={label} className="text-sm">
              <div className="flex justify-between text-slate-700">
                <span>{label}</span>
                <span className="text-slate-500">{n}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                <div className="h-1.5 rounded-full bg-[#5B4EE8]" style={{ width: `${total ? (n / total) * 100 : 0}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function csv(responses: Response[]) {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const head = ['date', 'email', 'disappointed', 'uses', 'heard', 'missing', 'call', 'contact']
  const lines = responses.map((r) =>
    [r.at, r.email, r.answers.disappointed, (r.answers.uses ?? []).join('; '), r.answers.heard, r.answers.missing, r.answers.call, r.answers.contact]
      .map(esc)
      .join(',')
  )
  return [head.join(','), ...lines].join('\n')
}

export default function SurveyResultsPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const { fetchWithAuth } = useAuthFetch()
  const [data, setData] = useState<Results | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/login')
      return
    }
    fetchWithAuth(`${API_URL}/admin/survey-responses`)
      .then(async (r) => {
        if (r.status === 403) throw new Error('This page is only for the ClassMate founder.')
        if (!r.ok) throw new Error('Couldn’t load responses. Try again in a minute.')
        setData(await r.json())
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Couldn’t load responses.'))
  }, [user, loading, router, fetchWithAuth])

  const stats = useMemo(() => {
    const rs = data?.responses ?? []
    const very = rs.filter((r) => r.answers.disappointed === 'very').length
    return {
      very,
      pmf: rs.length ? Math.round((very / rs.length) * 100) : 0,
      disappointed: tally(rs.map((r) => DISAPPOINTED_LABEL[r.answers.disappointed ?? ''] ?? r.answers.disappointed)),
      uses: tally(rs.flatMap((r) => r.answers.uses ?? [])),
      heard: tally(rs.map((r) => r.answers.heard)),
      calls: rs.filter((r) => r.answers.call === 'yes'),
    }
  }, [data])

  if (error) {
    return <main className="mx-auto max-w-3xl px-4 py-16 text-center text-slate-600">{error}</main>
  }
  if (!data) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#5B8DEF] border-t-transparent" />
      </main>
    )
  }

  const responses = [...data.responses].reverse() // newest first
  const download = () => {
    const url = URL.createObjectURL(new Blob([csv(data.responses)], { type: 'text/csv' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `classmate-survey-${data.survey_key}.csv` })
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 pt-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Survey responses</h1>
          <p className="text-sm text-slate-500">
            {data.survey_key} · {data.answered} answered · {data.dismissed} said &ldquo;not now&rdquo;
          </p>
        </div>
        {data.answered > 0 && (
          <button onClick={download} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:border-[#5B4EE8] hover:text-[#5B4EE8]">
            Download CSV
          </button>
        )}
      </div>

      {data.answered === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-slate-500">
          No responses yet. The survey shows once on the home page for accounts at least 3 days old.
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Would be very disappointed without ClassMate</p>
              <p className="mt-1 text-4xl font-bold text-slate-900">{stats.pmf}%</p>
              <p className="mt-1 text-xs text-slate-400">
                {stats.very} of {data.answered}. 40%+ is the usual sign people truly need it.
              </p>
            </div>
            <Bars title="How disappointed" rows={stats.disappointed} total={data.answered} />
            <Bars title="How they heard about it" rows={stats.heard} total={data.answered} />
          </div>
          <div className="mb-6 grid gap-4 md:grid-cols-2">
            <Bars title="What they use" rows={stats.uses} total={data.answered} />
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Up for a 15-minute call ({stats.calls.length})</h3>
              {stats.calls.length === 0 ? (
                <p className="text-sm text-slate-400">Nobody yet</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {stats.calls.map((r, i) => (
                    <li key={i} className="flex justify-between gap-3">
                      <span className="text-slate-700">{r.answers.contact || r.email}</span>
                      {r.email && (
                        <a className="text-[#5B4EE8] hover:underline" href={`mailto:${r.email}?subject=Quick%20ClassMate%20call%3F`}>
                          Email
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-400">Every response</h2>
          <div className="space-y-3">
            {responses.map((r, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span>{r.email ?? 'Unknown'}</span>
                  <span>{r.at ? new Date(r.at + (r.at.endsWith('Z') ? '' : 'Z')).toLocaleString() : ''}</span>
                </div>
                {r.answers.missing ? (
                  <p className="mt-2 text-base text-slate-900">&ldquo;{r.answers.missing}&rdquo;</p>
                ) : (
                  <p className="mt-2 text-sm italic text-slate-400">No written answer</p>
                )}
                <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                  {r.answers.disappointed && (
                    <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-700">
                      {DISAPPOINTED_LABEL[r.answers.disappointed] ?? r.answers.disappointed}
                    </span>
                  )}
                  {(r.answers.uses ?? []).map((u) => (
                    <span key={u} className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{u}</span>
                  ))}
                  {r.answers.heard && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">via {r.answers.heard}</span>}
                  {r.answers.call === 'yes' && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">Call: yes</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  )
}
