'use client'

import { useState } from 'react'
import posthog from 'posthog-js'
import { MessageSquareHeart, Check } from 'lucide-react'

// Fall 2026 feedback survey for existing users (shown once; answers in /admin/survey-responses).
// Q1 is the standard product-market-fit question: 40%+ "very disappointed" is the signal.
const DISAPPOINTED = [
  { value: 'very', label: 'Very disappointed' },
  { value: 'somewhat', label: 'Somewhat disappointed' },
  { value: 'not', label: 'Not disappointed' },
]
const USES = ['Seeing what’s due', 'Syllabus upload', 'Calendar', 'LMS sync (OAKS/Canvas)', 'Flashcards & quizzes', 'AI chat', 'Notes']
const HEARD = ['ChatGPT', 'Google', 'A friend', 'A professor or class', 'Instagram / TikTok', 'Other']

interface Props {
  email?: string | null
  onSubmit: (answers: Record<string, unknown>) => void
  onDismiss: () => void
}

function Chip({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${on ? 'border-[#5B8DEF] bg-[#EEF2FF] font-medium text-[#3B5BDB]' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
    >
      {label}
    </button>
  )
}

export default function FeedbackSurvey({ email, onSubmit, onDismiss }: Props) {
  const [disappointed, setDisappointed] = useState('')
  const [uses, setUses] = useState<string[]>([])
  const [heard, setHeard] = useState('')
  const [missing, setMissing] = useState('')
  const [call, setCall] = useState<'' | 'yes' | 'no'>('')
  const [contact, setContact] = useState(email ?? '')
  const [done, setDone] = useState(false)

  const toggleUse = (u: string) => setUses((cur) => (cur.includes(u) ? cur.filter((x) => x !== u) : [...cur, u]))
  const canSubmit = !!disappointed && (call !== 'yes' || contact.trim().length > 3)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    const answers = { disappointed, uses, heard, missing: missing.trim(), call: call || 'no', contact: call === 'yes' ? contact.trim() : null }
    posthog.capture('feedback_survey_submitted', { disappointed, heard, call: call || 'no' })
    onSubmit(answers)
    setDone(true)
  }

  if (done) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 p-5">
        <Check className="h-5 w-5 shrink-0 text-green-600" />
        <p className="text-sm text-green-800">
          Thank you. This goes straight to the founder{call === 'yes' ? ', who will reach out about a quick call' : ''}.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <MessageSquareHeart className="mt-0.5 h-5 w-5 shrink-0 text-[#5B8DEF]" />
        <div>
          <h3 className="text-base font-semibold text-slate-900">Help shape ClassMate (1 minute)</h3>
          <p className="mt-0.5 text-sm text-slate-500">A student is building this. Honest answers help the most.</p>
        </div>
      </div>

      <fieldset className="mt-5">
        <legend className="text-sm font-medium text-slate-800">How would you feel if you could no longer use ClassMate?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {DISAPPOINTED.map((o) => <Chip key={o.value} on={disappointed === o.value} label={o.label} onClick={() => setDisappointed(o.value)} />)}
        </div>
      </fieldset>

      <fieldset className="mt-5">
        <legend className="text-sm font-medium text-slate-800">What do you use it for most? <span className="font-normal text-slate-400">(pick any)</span></legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {USES.map((u) => <Chip key={u} on={uses.includes(u)} label={u} onClick={() => toggleUse(u)} />)}
        </div>
      </fieldset>

      <label className="mt-5 block">
        <span className="text-sm font-medium text-slate-800">What&apos;s missing, or what almost made you stop using it?</span>
        <textarea
          value={missing}
          onChange={(e) => setMissing(e.target.value)}
          rows={3}
          maxLength={1500}
          placeholder="Anything goes. What’s annoying, confusing, or not there yet?"
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition-colors focus:border-[#5B8DEF] focus:ring-2 focus:ring-[#5B8DEF]/20"
        />
      </label>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-slate-800">How did you hear about ClassMate?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {HEARD.map((h) => <Chip key={h} on={heard === h} label={h} onClick={() => setHeard(h)} />)}
        </div>
      </fieldset>

      <fieldset className="mt-5 rounded-xl bg-[#F5F7FF] p-4">
        <legend className="sr-only">Quick call</legend>
        <p className="text-sm font-medium text-slate-800">Free Spring Semester Pass for a 15-minute call?</p>
        <p className="mt-0.5 text-sm text-slate-500">Talk to the founder about how you study and what would make ClassMate worth it.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip on={call === 'yes'} label="Yes, I’m in" onClick={() => setCall('yes')} />
          <Chip on={call === 'no'} label="No thanks" onClick={() => setCall('no')} />
        </div>
        {call === 'yes' && (
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            maxLength={120}
            placeholder="Best phone number or email"
            className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#5B8DEF] focus:ring-2 focus:ring-[#5B8DEF]/20"
          />
        )}
      </fieldset>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
        >
          Send feedback
        </button>
        <button type="button" onClick={onDismiss} className="text-sm font-medium text-slate-400 hover:text-slate-600">
          Not now
        </button>
      </div>
    </form>
  )
}
