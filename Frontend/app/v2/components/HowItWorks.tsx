'use client'

import dynamic from 'next/dynamic'

// Skips SSR entirely — the animated 4-scene phone demo is decorative/
// interactive only, and server-rendering its full scene tree on every
// request is expensive for no SEO benefit (the section heading below
// stays server-rendered).
const DemoPhone = dynamic(() => import('./how-it-works/DemoPhone'), { ssr: false })

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 px-6 bg-gradient-to-br from-[#F8FAFF] to-[#EEF2FF]">
      <div className="max-w-4xl mx-auto text-center mb-14">
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">How ClassMate works</h2>
        <p className="text-xl text-slate-600">Four steps. Chat does the rest.</p>
      </div>

      <div className="max-w-5xl mx-auto">
        <DemoPhone />
      </div>
    </section>
  )
}
