'use client'

import { useEffect, useState } from 'react'
import { useInView } from '../../../hooks/useInView'
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion'
import RevealOnScroll from './RevealOnScroll'
import { BRAND } from './tokens'

const quoteCards = [
  {
    id: 'buried-in-canvas',
    quote: '"I got a zero on an exam I didn\'t know existed."',
    body: 'The quiz was buried in Canvas, hidden in a syllabus PDF, or posted in an announcement I never saw.',
  },
  {
    id: 'too-many-platforms',
    quote: '"Too many platforms. No direction."',
    body: 'Canvas. Google Drive. Email. Slides. PDFs. Group chats. Nothing shows what actually matters next.',
  },
]

function AnimatedPercent({ target }: { target: number }) {
  const { ref, inView } = useInView<HTMLSpanElement>(0.5)
  const reducedMotion = usePrefersReducedMotion()
  const [value, setValue] = useState(() => (reducedMotion ? target : 0))

  useEffect(() => {
    if (!inView || reducedMotion) return
    const duration = 1200
    const start = performance.now()
    let raf: number
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - (1 - progress) ** 3
      setValue(Math.round(eased * target))
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, reducedMotion, target])

  return <span ref={ref}>{value}</span>
}

export default function ProblemStory() {
  return (
    <section id="features" className="py-16 md:py-20 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 text-center mb-10 md:mb-12">
          You&apos;re not disorganized. Your semester is.
        </h2>

        <RevealOnScroll className="grid gap-10 lg:grid-cols-2 lg:gap-16 items-start">
          {/* Stat card — the section's one focal point. First on mobile, right column on desktop. */}
          <div className="order-1 lg:order-2">
            <div className="rounded-3xl border border-slate-200 bg-slate-50/60 p-8 md:p-10">
              <p
                className="text-[96px] md:text-[120px] font-bold leading-none tracking-tight"
                style={{ color: BRAND }}
              >
                <AnimatedPercent target={47} />%
              </p>
              <p className="mt-5 text-lg text-slate-700 leading-relaxed max-w-[38ch]">
                of college students have missed a critical deadline because of scattered digital systems.
              </p>
              <p className="mt-6 text-xs text-slate-400">Pathify student survey, 2025, n=1,000+.</p>
            </div>
          </div>

          {/* Narrative — left column on desktop, second on mobile */}
          <div className="order-2 lg:order-1 flex flex-col gap-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">Week one:</p>
              <p className="text-lg md:text-xl text-slate-600 leading-relaxed max-w-[55ch]">
                Five syllabi, five PDFs, deadlines scattered across Canvas, email, and page 7 of a document
                you&apos;ll never open again.
              </p>
            </div>

            <p className="text-lg md:text-xl text-slate-600 leading-relaxed max-w-[55ch]">
              ClassMate fixes this with <span className="font-medium text-slate-900">one upload</span>. Drop
              your syllabi in, and every deadline, policy, and detail becomes something you can{' '}
              <span className="font-medium text-slate-900">just ask</span> about.
            </p>

            <div className="flex flex-col gap-3 mt-1">
              {quoteCards.map((card) => (
                <div
                  key={card.id}
                  className="rounded-2xl p-5 bg-gradient-to-br from-white via-[#F4F8FF] to-[#EAF2FF] border border-[#D6E6FF]"
                >
                  <h3 className="text-sm font-bold text-slate-900 mb-1.5 leading-snug">{card.quote}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{card.body}</p>
                </div>
              ))}
            </div>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  )
}
