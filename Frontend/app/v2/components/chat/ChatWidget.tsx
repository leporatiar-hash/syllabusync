'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from '../../../../hooks/usePrefersReducedMotion'
import { introExchange, suggestions as allSuggestions, type Suggestion, type ScriptedAnswer } from './scripts'
import TypingIndicator from './TypingIndicator'
import FlashcardPreview from './FlashcardPreview'
import { BRAND } from '../tokens'

type Msg = { id: string; role: 'user' | 'ai'; text?: string; answer?: ScriptedAnswer }

function AnswerContent({ answer }: { answer: ScriptedAnswer }) {
  if (answer.kind === 'text') return <>{answer.text}</>

  if (answer.kind === 'deadlines') {
    return (
      <div>
        <p>{answer.intro}</p>
        <ul className="mt-2.5 space-y-1.5">
          {answer.items.map((item) => (
            <li
              key={item.title}
              className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs"
            >
              <span className="font-medium text-slate-700">
                {item.course} — {item.title}
              </span>
              <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500 border border-slate-200">
                {item.when}
              </span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div>
      <p>{answer.intro}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {answer.cards.map((c) => (
          <FlashcardPreview key={c.front} {...c} />
        ))}
      </div>
      <p className="mt-2 text-[11px] text-slate-400">Tap a card to flip it</p>
    </div>
  )
}

function ChatHeader() {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
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
  )
}

function UserBubble({ text, animate }: { text: string; animate: boolean }) {
  return (
    <div className={`flex justify-end ${animate ? 'msg-in' : ''}`}>
      <div
        className="max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-white"
        style={{ background: BRAND }}
      >
        {text}
      </div>
    </div>
  )
}

function AiBubble({ answer, animate }: { answer: ScriptedAnswer; animate: boolean }) {
  return (
    <div className={`flex justify-start ${animate ? 'msg-in' : ''}`}>
      <div className="max-w-[88%] rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-700 bg-white border border-slate-200 shadow-sm leading-relaxed">
        <AnswerContent answer={answer} />
      </div>
    </div>
  )
}

const INTRO_ID = 'intro'

export default function ChatWidget({ variant = 'interactive' }: { variant?: 'interactive' | 'static' }) {
  const reducedMotion = usePrefersReducedMotion()
  const [messages, setMessages] = useState<Msg[]>([])
  const [typing, setTyping] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [usedIds, setUsedIds] = useState<Set<string>>(new Set())
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  const schedule = useCallback(
    (fn: () => void, ms: number) => {
      const id = setTimeout(fn, reducedMotion ? 0 : ms)
      timers.current.push(id)
    },
    [reducedMotion]
  )

  const clearTimers = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  const runIntro = useCallback(() => {
    clearTimers()
    setMessages([])
    setShowSuggestions(false)
    setUsedIds(new Set())
    schedule(() => {
      setMessages([{ id: `${INTRO_ID}-q`, role: 'user', text: introExchange.question }])
      schedule(() => {
        setTyping(true)
        schedule(() => {
          setTyping(false)
          setMessages((m) => [...m, { id: `${INTRO_ID}-a`, role: 'ai', answer: introExchange.answer }])
          schedule(() => setShowSuggestions(true), 500)
        }, 1300)
      }, 500)
    }, 400)
  }, [schedule])

  useEffect(() => {
    if (variant !== 'interactive') return
    // Intentionally re-runs on React Strict Mode's dev-only mount→cleanup→mount
    // cycle: the phantom first pass gets cancelled by the cleanup below, and the
    // real mount schedules a fresh, uninterrupted chain. A "run once" ref guard
    // here would let the phantom pass win and the intro would never play.
    //
    // It also depends on `reducedMotion`, which starts false and resolves via
    // its own effect a moment after mount (to avoid an SSR hydration mismatch).
    // Without that dependency, a reduced-motion visitor's first run would have
    // already captured the stale `false` value and play the full-speed timings.
    runIntro()
    return clearTimers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, reducedMotion])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, typing, showSuggestions])

  const handleSuggestion = (s: Suggestion) => {
    if (usedIds.has(s.id) || typing) return
    setUsedIds((prev) => new Set(prev).add(s.id))
    setMessages((m) => [...m, { id: `${s.id}-q`, role: 'user', text: s.question }])
    schedule(() => {
      setTyping(true)
      schedule(() => {
        setTyping(false)
        setMessages((m) => [...m, { id: `${s.id}-a`, role: 'ai', answer: s.answer }])
      }, 1100)
    }, 350)
  }

  const handleReset = () => runIntro()

  if (variant === 'static') {
    return (
      <div className="flex h-full flex-col bg-white">
        <ChatHeader />
        <div className="flex-1 space-y-3 bg-[#F9FAFB] p-4">
          <UserBubble text={introExchange.question} animate={false} />
          <AiBubble answer={introExchange.answer} animate={false} />
        </div>
      </div>
    )
  }

  const allUsed = usedIds.size === allSuggestions.length

  return (
    <div className="flex h-full flex-col bg-white">
      <ChatHeader />

      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-label="ClassMate AI demo conversation"
        className="min-h-0 flex-1 space-y-4 overflow-y-auto scroll-smooth bg-[#F9FAFB] p-4"
      >
        {messages.map((m) =>
          m.role === 'user' ? (
            <UserBubble key={m.id} text={m.text as string} animate={!reducedMotion} />
          ) : (
            <AiBubble key={m.id} answer={m.answer as ScriptedAnswer} animate={!reducedMotion} />
          )
        )}
        {typing && <TypingIndicator />}
      </div>

      {/* Suggested questions */}
      <div className="shrink-0 border-t border-slate-100 bg-white px-3 py-3">
        {showSuggestions ? (
          <div className="flex flex-col gap-2">
            {allSuggestions.map((s) => {
              const used = usedIds.has(s.id)
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSuggestion(s)}
                  disabled={used || typing}
                  aria-pressed={used}
                  className={`flex w-full items-center gap-1.5 rounded-full border px-3.5 py-2 text-left text-xs font-medium transition-colors ${
                    used
                      ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-default'
                      : 'border-slate-200 text-slate-700 hover:border-[#5B4EE8] hover:text-[#5B4EE8] disabled:opacity-50'
                  }`}
                >
                  {used && (
                    <svg className="h-3 w-3 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  <span className="truncate">{s.question}</span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="h-[38px]" aria-hidden="true" />
        )}

        {allUsed && (
          <button
            type="button"
            onClick={handleReset}
            className="mt-3 text-xs font-medium text-slate-400 hover:text-[#5B4EE8] transition-colors"
          >
            ↺ Restart demo
          </button>
        )}
      </div>

      {/* Decorative input — the real chat input lives in the app */}
      <div className="shrink-0 flex items-center gap-2 border-t border-slate-100 bg-white px-3 py-3">
        <div className="flex-1 truncate text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200 px-3.5 py-2.5 select-none">
          Try a suggestion above
        </div>
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 opacity-60"
          aria-hidden="true"
          style={{ background: BRAND }}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
        </div>
      </div>
    </div>
  )
}
