'use client'

import { useEffect, useRef, useState } from 'react'
import type { SceneProps } from './constants'

type Phase = 'idle' | 'dropping' | 'parsing' | 'done'

export default function UploadScene({ reducedMotion }: SceneProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    const clear = () => {
      timers.current.forEach(clearTimeout)
      timers.current = []
    }
    if (reducedMotion) {
      timers.current.push(setTimeout(() => setPhase('done'), 0))
      return clear
    }
    timers.current.push(setTimeout(() => setPhase('dropping'), 500))
    timers.current.push(setTimeout(() => setPhase('parsing'), 1200))
    timers.current.push(setTimeout(() => setPhase('done'), 2600))
    return clear
  }, [reducedMotion])

  const fileDropped = phase !== 'idle'

  return (
    <div className="flex h-full flex-col bg-[#FAFAFA] px-4 pt-4">
      {/* Real course header: gradient banner + course-code eyebrow */}
      <div className="shrink-0 rounded-2xl bg-gradient-to-r from-[#E0EAFF] via-[#F3E8FF] to-[#E0F2FE] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">FINC 400</p>
        <h3 className="mt-1 text-lg font-semibold text-slate-900">Corporate Finance</h3>
        <p className="mt-0.5 text-xs text-slate-600">Fall 2026</p>
      </div>

      {/* Upload syllabus card */}
      <div className="mt-4 flex-1 rounded-2xl bg-white p-4 shadow-sm">
        <h4 className="text-sm font-semibold text-slate-900">Upload syllabus</h4>
        <p className="mt-1 text-xs text-slate-500">Add a syllabus PDF to extract deadlines automatically.</p>

        {!fileDropped ? (
          <div className="mt-3 flex min-h-[112px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-5 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M8 7h8M8 11h8M8 15h5" />
                <rect x="5" y="3" width="14" height="18" rx="3" />
              </svg>
            </div>
            <p className="mt-3 text-xs font-medium text-slate-700">Drop or click to upload syllabus</p>
            <p className="mt-1 text-[11px] text-slate-400">PDF or Word doc, max 10MB</p>
          </div>
        ) : (
          <div className="mt-3 msg-in rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FEE2E2] text-[#FB7185]">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M8 7h8M8 11h8M8 15h5" />
                  <rect x="5" y="3" width="14" height="18" rx="3" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-slate-900">FINC400_Syllabus.pdf</p>
                <p className="text-[11px] text-slate-500">248 KB</p>
              </div>
            </div>
          </div>
        )}

        <div
          className="mt-3 w-full rounded-full px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm"
          style={{ background: 'linear-gradient(to right, #5B8DEF, #7C9BF6)' }}
        >
          {phase === 'parsing' ? 'Extracting deadlines…' : 'Parse Syllabus'}
        </div>

        <div className="mt-3 min-h-[36px]">
          {phase === 'parsing' && (
            <div className="space-y-1.5">
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full"
                  style={{
                    background: 'linear-gradient(to right, #5B8DEF, #A78BFA)',
                    width: '100%',
                    transition: reducedMotion ? 'none' : 'width 1300ms ease-in-out',
                  }}
                />
              </div>
              <p className="text-center text-[11px] text-slate-500">Analyzing syllabus with AI...</p>
            </div>
          )}

          {phase === 'done' && (
            <div className="flex items-center justify-center gap-2 rounded-2xl bg-[#ECFDF3] py-2.5 text-sm font-semibold text-[#4ADE80] msg-in">
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              15 deadlines extracted
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
