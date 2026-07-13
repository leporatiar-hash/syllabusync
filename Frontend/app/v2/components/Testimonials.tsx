import RevealOnScroll from './RevealOnScroll'

const testimonials = [
  {
    stars: 5,
    quote:
      'I uploaded my syllabus Sunday night and had my entire semester in my calendar by Monday morning. I never miss a deadline anymore.',
    name: 'Sarah C.',
    meta: 'Business, CofC · Junior',
    initials: 'SC',
    bg: '#5B4EE8',
  },
  {
    stars: 5,
    quote:
      'The AI chat is wild. I asked it to quiz me on my notes and it just did it. Feels like having a tutor available at 2am.',
    name: 'Marcus T.',
    meta: 'Finance, CofC · Sophomore',
    initials: 'MT',
    bg: '#0F9D58',
  },
  {
    stars: 5,
    quote: "Connected it to Canvas and my iCal in like 2 minutes. Everything just synced. I didn't have to do anything else.",
    name: 'Jordan R.',
    meta: 'Marketing, CofC · Senior',
    initials: 'JR',
    bg: '#1976D2',
  },
]

export default function Testimonials() {
  return (
    <section className="py-24 px-6" style={{ background: '#F7F7FB' }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-4">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900">What students are saying</h2>
          <p className="mt-3 text-sm font-semibold text-slate-500">⭐ 4.8/5 average rating</p>
        </div>
        <RevealOnScroll className="grid md:grid-cols-3 gap-6 mt-10">
          {testimonials.map((t) => (
            <div key={t.name} className="bg-white rounded-2xl border border-slate-200 p-7 shadow-sm flex flex-col gap-4">
              <div className="flex gap-0.5">
                {Array.from({ length: t.stars }).map((_, i) => (
                  <svg key={i} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-slate-700 text-sm leading-relaxed italic flex-1">&quot;{t.quote}&quot;</p>
              <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ background: t.bg }}
                >
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.meta}</p>
                </div>
              </div>
            </div>
          ))}
        </RevealOnScroll>
      </div>
    </section>
  )
}
