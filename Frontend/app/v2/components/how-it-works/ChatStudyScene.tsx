'use client'

import { useEffect, useRef, useState } from 'react'
import { introExchange } from '../chat/scripts'
import TypingIndicator from '../chat/TypingIndicator'
import { BRAND } from '../tokens'
import type { SceneProps } from './constants'

type Phase = 'typing' | 'answered' | 'study'

export default function ChatStudyScene({ reducedMotion }: SceneProps) {
  const [phase, setPhase] = useState<Phase>(reducedMotion ? 'study' : 'typing')
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    const clear = () => {
      timers.current.forEach(clearTimeout)
      timers.current = []
    }
    if (reducedMotion) {
      timers.current.push(setTimeout(() => setPhase('study'), 0))
      return clear
    }
    timers.current.push(setTimeout(() => setPhase('answered'), 1200))
    timers.current.push(setTimeout(() => setPhase('study'), 2200))
    return clear
  }, [reducedMotion])

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-white">
      <div className="shrink-0 flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
          style={{ background: BRAND }}
        >
          CM
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">ClassMate AI</p>
          <p className="text-[11px] text-slate-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            Online
          </p>
        </div>
      </div>

      <div className="flex-1 space-y-3 bg-[#F9FAFB] px-4 py-4">
        <div className={`flex justify-end ${reducedMotion ? '' : 'msg-in'}`}>
          <div
            className="max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-white"
            style={{ background: BRAND }}
          >
            {introExchange.question}
          </div>
        </div>

        {phase === 'typing' && <TypingIndicator />}

        {phase !== 'typing' && (
          <div className={`flex justify-start ${reducedMotion ? '' : 'msg-in'}`}>
            <div className="max-w-[88%] rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-700 bg-white border border-slate-200 shadow-sm leading-relaxed">
              {introExchange.answer.text}
            </div>
          </div>
        )}
      </div>

      {/* Study tools bottom sheet */}
      <div
        className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-slate-200 bg-white px-5 pb-5 pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]"
        style={{
          transform: phase === 'study' ? 'translateY(0)' : 'translateY(100%)',
          transition: reducedMotion ? 'none' : 'transform 500ms ease-out',
        }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" />
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Study tools</p>

        <div
          className="flex h-16 flex-col items-center justify-center rounded-xl border px-3 text-center"
          style={{ background: '#F7F7FB', borderColor: '#E4E1FB' }}
        >
          <span className="text-[9px] font-semibold text-slate-400">FLASHCARD</span>
          <span className="text-sm font-bold text-slate-800">Mitochondria</span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <div className="rounded-xl border border-slate-200 px-3 py-2.5 text-center">
            <p className="text-xs font-semibold text-slate-800">Quiz</p>
            <p className="text-[11px] text-slate-400">8 questions</p>
          </div>
          <div className="rounded-xl border border-slate-200 px-3 py-2.5 text-center">
            <p className="text-xs font-semibold text-slate-800">Summary</p>
            <p className="text-[11px] text-slate-400">5 bullets</p>
          </div>
        </div>
      </div>
    </div>
  )
}
