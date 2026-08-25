'use client'

import { useState } from 'react'

interface Props {
  onSubmit: (answer: string) => void
  onSkip: () => void
}

export default function ValuePropPrompt({ onSubmit, onSkip }: Props) {
  const [answer, setAnswer] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = answer.trim()
    if (!trimmed) return
    onSubmit(trimmed)
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Quick question</h3>
      <p className="mt-1 text-sm text-slate-600">
        What&apos;s the one thing you&apos;d hate to lose about ClassMate?
      </p>
      <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Type your answer..."
          maxLength={500}
          autoFocus
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition-colors focus:border-[#5B8DEF] focus:ring-2 focus:ring-[#5B8DEF]/20"
        />
        <div className="flex shrink-0 gap-2">
          <button
            type="submit"
            disabled={!answer.trim()}
            className="rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
          >
            Send
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="rounded-full px-4 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100"
          >
            Skip
          </button>
        </div>
      </form>
    </div>
  )
}
