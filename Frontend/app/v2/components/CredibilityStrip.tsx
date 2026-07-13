'use client'

import { useEffect, useState } from 'react'
import { API_BASE_URL } from '../../../lib/config'

export default function CredibilityStrip() {
  const [syllabiLabel, setSyllabiLabel] = useState('116+')

  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE_URL}/stats`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.syllabi_count != null) {
          setSyllabiLabel(`${data.syllabi_count}+`)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="border-t border-b border-slate-200 bg-[#F7F7FB]">
      <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-center">
        <span className="text-sm font-medium text-slate-600">
          Built and used by students at the College of Charleston
        </span>
        <span className="hidden sm:inline text-slate-300">·</span>
        <span className="text-sm font-medium text-slate-600">
          <span className="font-bold text-slate-900">{syllabiLabel}</span> syllabi uploaded
        </span>
        <span className="hidden sm:inline text-slate-300">·</span>
        <span className="text-sm font-medium text-slate-600">
          🏆 2nd Place — CofC AI Innovation Challenge
        </span>
      </div>
    </div>
  )
}
