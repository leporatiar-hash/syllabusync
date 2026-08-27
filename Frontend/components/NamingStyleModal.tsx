'use client'

import { useEffect, useState } from 'react'
import { API_URL, useAuthFetch } from '../hooks/useAuthFetch'

interface NamingStyleModalProps {
  onConfirm: (namingStyle: 'simple' | 'descriptive') => void
  onCancel: () => void
}

const OPTIONS: { value: 'simple' | 'descriptive'; label: string; hint: string; example: string }[] = [
  { value: 'simple', label: 'Simple', hint: 'Short labels', example: '"Quiz 1", "HW 1 Due"' },
  {
    value: 'descriptive',
    label: 'Descriptive',
    hint: 'Full detail from the syllabus',
    example: '"Ch. 2, pp 55-70, Appendix B, pp 391-395"',
  },
]

export default function NamingStyleModal({ onConfirm, onCancel }: NamingStyleModalProps) {
  const { fetchWithAuth } = useAuthFetch()
  const [namingStyle, setNamingStyle] = useState<'simple' | 'descriptive'>('simple')

  useEffect(() => {
    fetchWithAuth(`${API_URL}/me`).then(async (res) => {
      if (!res.ok) return
      const data = await res.json()
      const saved = data.profile?.naming_style
      if (saved === 'simple' || saved === 'descriptive') setNamingStyle(saved)
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Name assignments how?</h2>
          <button
            onClick={onCancel}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500 transition-all duration-300 hover:border-slate-300"
          >
            Cancel
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Choose how deadline titles pulled from this syllabus should look.
        </p>

        <div className="mt-6 space-y-3">
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setNamingStyle(opt.value)}
              className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                namingStyle === opt.value
                  ? 'border-[#5B8DEF] bg-[#5B8DEF]/5 ring-2 ring-[#5B8DEF]/20'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className="block text-sm font-semibold text-slate-800">{opt.label}</span>
              <span className="mt-0.5 block text-xs text-slate-500">{opt.hint} — {opt.example}</span>
            </button>
          ))}
        </div>

        <p className="mt-4 text-xs text-slate-400">
          You can change your default in Settings.
        </p>

        <button
          onClick={() => onConfirm(namingStyle)}
          className="mt-6 w-full rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
