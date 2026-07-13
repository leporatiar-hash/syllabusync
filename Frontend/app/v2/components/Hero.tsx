'use client'

import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import PhoneFrame from './PhoneFrame'
import { BRAND } from './tokens'

// Skips SSR entirely — this widget is decorative/interactive only, and
// server-rendering its full scripted state machine on every request is
// expensive for no benefit (nothing in it is real SEO content).
const ChatWidget = dynamic(() => import('./chat/ChatWidget'), { ssr: false })

export default function Hero() {
  const router = useRouter()

  return (
    <section id="top" className="pt-24 lg:pt-28 pb-16 px-6 bg-white w-full">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: copy */}
          <div>
            <h1 className="text-5xl md:text-6xl font-bold text-slate-900 leading-tight mb-6">
              The AI that knows your entire semester.
            </h1>
            <p className="text-lg text-slate-600 mb-8 leading-relaxed max-w-lg">
              Upload your syllabus once. Ask anything — deadlines, policies, what&apos;s due this week.
              ClassMate answers from your actual courses.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => router.push('/signup')}
                className="px-8 py-4 text-base font-semibold text-white rounded-xl shadow-lg hover:shadow-xl hover:opacity-90 transition-all"
                style={{ background: BRAND }}
              >
                Start Free Today
              </button>
              <button
                onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-8 py-4 text-base font-semibold text-slate-700 bg-white border-2 border-slate-200 rounded-xl hover:border-[#5B4EE8] transition-colors"
              >
                See How It Works
              </button>
            </div>
            <p className="text-sm text-slate-400 mt-3">Works in your browser — no download needed</p>
          </div>

          {/* Right: interactive chat demo */}
          <div className="w-full">
            <PhoneFrame>
              <ChatWidget variant="interactive" />
            </PhoneFrame>
            <p className="mt-4 text-center text-xs text-slate-400">
              Interactive preview — real answers come from your syllabus.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
