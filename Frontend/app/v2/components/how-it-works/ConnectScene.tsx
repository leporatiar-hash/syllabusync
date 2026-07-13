'use client'

import { useEffect, useRef, useState } from 'react'
import type { SceneProps } from './constants'

type Phase = 'idle' | 'connecting' | 'connected'

export default function ConnectScene({ reducedMotion }: SceneProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    const clear = () => {
      timers.current.forEach(clearTimeout)
      timers.current = []
    }
    if (reducedMotion) {
      timers.current.push(setTimeout(() => setPhase('connected'), 0))
      return clear
    }
    timers.current.push(setTimeout(() => setPhase('connecting'), 500))
    timers.current.push(setTimeout(() => setPhase('connected'), 1600))
    return clear
  }, [reducedMotion])

  return (
    <div className="flex h-full flex-col bg-[#FAFAFA]">
      <div className="shrink-0 border-b border-slate-100 px-5 py-4">
        <p className="text-base font-semibold text-slate-900">Connect Canvas</p>
      </div>

      <div className="flex flex-1 flex-col justify-center px-5 py-8">
        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E8290B] text-white text-sm font-bold">
              C
            </span>
            <div>
              <p className="text-base font-semibold text-slate-900">Canvas / OAKS</p>
              <p className="text-xs text-slate-500">Sync assignments &amp; due dates automatically</p>
            </div>
          </div>

          <div
            className={`mt-4 w-full rounded-full px-5 py-3 text-sm font-semibold text-center transition-all duration-300 ${
              phase === 'connected'
                ? 'bg-green-50 text-green-600 border border-green-100'
                : 'text-white shadow-sm'
            }`}
            style={phase === 'connected' ? undefined : { background: 'linear-gradient(to right, #5B8DEF, #7C9BF6)' }}
          >
            {phase === 'idle' && 'Connect Canvas'}
            {phase === 'connecting' && (
              <span className="inline-flex items-center justify-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-white/60 border-t-white animate-spin" />
                Connecting…
              </span>
            )}
            {phase === 'connected' && (
              <span className="inline-flex items-center justify-center gap-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Connected
              </span>
            )}
          </div>
        </div>

        <p className="mt-4 text-xs text-slate-400 text-center">Also syncs with iCal, Google Calendar &amp; Outlook</p>
      </div>
    </div>
  )
}
