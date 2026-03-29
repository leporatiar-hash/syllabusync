'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function LandingPage() {
  const router = useRouter()
  const [scrollY, setScrollY] = useState(0)
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set())
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleSections((prev) => new Set(prev).add(entry.target.id))
          }
        })
      },
      { threshold: 0.15 }
    )
    document.querySelectorAll('[data-reveal]').forEach((el) => {
      observerRef.current?.observe(el)
    })
    return () => observerRef.current?.disconnect()
  }, [])

  const isVisible = (id: string) => visibleSections.has(id)

  return (
    <div className="min-h-screen bg-white">

      {/* ── Navigation ─────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/brand/classmate-owl.png" alt="ClassMate" className="h-8 w-auto" />
            <span className="text-xl font-bold text-slate-900">ClassMate</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/login')}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Log in
            </button>
            <button
              onClick={() => router.push('/signup')}
              className="px-5 py-2 text-sm font-semibold text-white bg-[#5B4EE8] rounded-lg shadow-sm hover:opacity-90 transition-opacity"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="pt-32 pb-20 px-6 bg-white w-full">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">

            {/* Left: Copy */}
            <div
              className="transition-all duration-1000"
              style={{
                opacity: Math.min(1, 1 - scrollY / 600),
                transform: `translateY(${scrollY * 0.25}px)`,
              }}
            >
              {/* Eyebrow badge */}
              <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-6 text-sm font-semibold" style={{ background: '#EEEDFE', color: '#3C3489' }}>
                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 2a5 5 0 110 10A5 5 0 018 3z" opacity=".3"/>
                  <path d="M8 6a1 1 0 011 1v4a1 1 0 11-2 0V7a1 1 0 011-1zM8 4.5a1 1 0 110 2 1 1 0 010-2z"/>
                </svg>
                AI-powered student workspace
              </div>

              <h1 className="text-5xl md:text-6xl font-bold text-slate-900 leading-tight mb-6">
                Stop organizing.<br />
                <em className="not-italic" style={{ color: '#5B4EE8', fontStyle: 'italic' }}>Start learning.</em>
              </h1>

              <p className="text-lg text-slate-600 mb-8 leading-relaxed max-w-lg">
                Upload your syllabus once. ClassMate extracts every deadline, builds your calendar, generates flashcards — and answers any question about your semester.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => router.push('/signup')}
                  className="px-8 py-4 text-base font-semibold text-white rounded-xl shadow-lg hover:shadow-xl hover:opacity-90 transition-all"
                  style={{ background: '#5B4EE8' }}
                >
                  Start Free Today
                </button>
                <button
                  onClick={() => {
                    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })
                  }}
                  className="px-8 py-4 text-base font-semibold text-slate-700 bg-white border-2 border-slate-200 rounded-xl hover:border-[#5B4EE8] transition-colors"
                >
                  See How It Works
                </button>
              </div>

              {/* Social proof */}
              <div className="mt-8 flex items-center gap-3">
                <div className="flex">
                  {[
                    { initials: 'AS', bg: '#5B4EE8' },
                    { initials: 'MK', bg: '#7C6FF0' },
                    { initials: 'JR', bg: '#A89AF5' },
                    { initials: 'BL', bg: '#C4BBF8' },
                  ].map((a, i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-white"
                      style={{ background: a.bg, marginLeft: i === 0 ? 0 : '-8px', zIndex: 4 - i }}
                    >
                      {a.initials}
                    </div>
                  ))}
                </div>
                <p className="text-sm text-slate-500">
                  <span className="font-semibold text-slate-700">47 students at CofC</span> already use ClassMate · ⭐ 4.8/5
                </p>
              </div>
            </div>

            {/* Right: Hero Image */}
            <div
              className="relative flex justify-center items-center transition-all duration-1000"
              style={{ transform: `translateY(${scrollY * 0.15}px)` }}
            >
              <div className="relative">
                <div className="pointer-events-none absolute -inset-10 rounded-[48px] bg-[radial-gradient(70%_70%_at_50%_40%,rgba(255,255,255,0.95),rgba(255,255,255,0.6),rgba(255,255,255,0))] blur-2xl" />
                <div
                  className="relative"
                  style={{
                    WebkitMaskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,1) 68%, rgba(0,0,0,0.94) 84%, rgba(0,0,0,0) 98%)',
                    maskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,1) 68%, rgba(0,0,0,0.94) 84%, rgba(0,0,0,0) 98%)',
                  }}
                >
                  <Image
                    src="/hero.png"
                    alt="ClassMate app preview"
                    width={546}
                    height={777}
                    className="select-none w-full max-w-[520px] h-auto"
                    priority
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Integrations Strip ─────────────────────────────────────── */}
      <div className="border-t border-b" style={{ borderColor: 'rgba(0,0,0,0.08)', background: '#F7F7FB' }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center gap-4">
          <span className="text-sm font-semibold text-slate-400 shrink-0">Works with</span>
          <div className="flex flex-wrap items-center gap-3">
            {[
              { letter: 'C', bg: '#E8290B', label: 'Canvas LMS' },
              { letter: 'i', bg: '#1976D2', label: 'iCal / Apple Calendar' },
              { letter: 'G', bg: '#0F9D58', label: 'Google Calendar' },
              { letter: 'O', bg: '#6B5CE7', label: 'Outlook Calendar' },
            ].map((item) => (
              <div key={item.label} className="inline-flex items-center gap-2 bg-white rounded-full px-3 py-1.5 text-sm font-medium text-slate-700 border border-slate-200 shadow-sm">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ background: item.bg }}>
                  {item.letter}
                </span>
                {item.label}
              </div>
            ))}
            <span className="text-sm text-slate-400 font-medium pl-1">+ any syllabus PDF</span>
          </div>
        </div>
      </div>

      {/* ── Pain Points ────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            You're not dumb.
            <br />
            <span className="text-slate-500">The tools and systems you are given to succeed are broken.</span>
          </h2>
        </div>

        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
          {[
            {
              id: 'pain-1',
              delay: '',
              quote: '"I got a zero on an exam I didn\'t know existed."',
              body: 'The quiz was buried in Canvas, hidden in a syllabus PDF, or posted in an announcement I never saw.',
            },
            {
              id: 'pain-2',
              delay: 'delay-150',
              quote: '"Too many platforms. No direction."',
              body: 'Canvas. Google Drive. Email. Slides. PDFs. Group chats. Nothing shows what actually matters next.',
            },
            {
              id: 'pain-3',
              delay: 'delay-300',
              quote: '"I waste more time organizing than studying."',
              body: "I'm constantly rewriting notes, making flashcards, and sorting deadlines instead of learning the material.",
            },
          ].map((p) => (
            <div
              key={p.id}
              id={p.id}
              data-reveal
              className={`transition-all duration-700 ${p.delay} ${isVisible(p.id) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
            >
              <div className="rounded-2xl p-8 h-full min-h-[220px] bg-gradient-to-br from-white via-[#F4F8FF] to-[#EAF2FF] border border-[#D6E6FF] shadow-sm flex flex-col justify-between">
                <h3 className="text-lg font-bold text-slate-900 mb-3 leading-snug">{p.quote}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{p.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 px-6 bg-gradient-to-br from-[#F8FAFF] to-[#EEF2FF]">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">How ClassMate works</h2>
          <p className="text-xl text-slate-600">Three steps. That's it.</p>
        </div>

        <div className="max-w-5xl mx-auto space-y-20">
          {/* Step 1 */}
          <div
            id="step-1"
            data-reveal
            className={`grid md:grid-cols-2 gap-12 items-center transition-all duration-700 ${isVisible('step-1') ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-12'}`}
          >
            <div>
              <div className="inline-flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-sm mb-4">
                <span className="w-6 h-6 rounded-full bg-[#5B4EE8] text-white text-xs font-bold flex items-center justify-center">1</span>
                <span className="text-sm font-semibold text-slate-900">Upload your syllabus</span>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Drop a PDF. We'll read it for you.</h3>
              <p className="text-slate-600 leading-relaxed">
                ClassMate extracts every deadline — quizzes, exams, assignments, projects — and adds them to your personal calendar automatically.
              </p>
            </div>
            <div className="relative w-full max-w-[600px] mx-auto">
              <div className="relative w-full aspect-[16/10] rounded-2xl shadow-2xl overflow-hidden border border-slate-200/60 bg-white p-4 md:p-5">
                <Image src="/screenshot-course-upload.png" fill className="object-contain" alt="Upload syllabus screenshot" sizes="(max-width: 768px) 100vw, 600px" quality={95} />
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div
            id="step-2"
            data-reveal
            className={`grid md:grid-cols-2 gap-12 items-center transition-all duration-700 ${isVisible('step-2') ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'}`}
          >
            <div className="order-2 md:order-1">
              <div className="relative w-full max-w-[600px] mx-auto">
                <div className="relative w-full aspect-[16/10] rounded-2xl shadow-2xl overflow-hidden border border-slate-200/60 bg-white p-4 md:p-5">
                  <Image src="/screenshot-calendar.png" fill className="object-contain" alt="Calendar view screenshot" sizes="(max-width: 768px) 100vw, 600px" quality={95} />
                </div>
              </div>
            </div>
            <div className="order-1 md:order-2">
              <div className="inline-flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-sm mb-4">
                <span className="w-6 h-6 rounded-full bg-[#5B4EE8] text-white text-xs font-bold flex items-center justify-center">2</span>
                <span className="text-sm font-semibold text-slate-900">Get your calendar</span>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Every deadline, automatically organized.</h3>
              <p className="text-slate-600 leading-relaxed">
                See what's due today, this week, and this month. Never miss another assignment, quiz, or exam.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div
            id="step-3"
            data-reveal
            className={`grid md:grid-cols-2 gap-12 items-center transition-all duration-700 ${isVisible('step-3') ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-12'}`}
          >
            <div>
              <div className="inline-flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-sm mb-4">
                <span className="w-6 h-6 rounded-full bg-[#5B4EE8] text-white text-xs font-bold flex items-center justify-center">3</span>
                <span className="text-sm font-semibold text-slate-900">Study smarter</span>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">AI-powered flashcards & quizzes in seconds.</h3>
              <p className="text-slate-600 leading-relaxed">
                Upload lecture notes, slides, or readings. ClassMate generates flashcards, practice quizzes, and study summaries instantly.
              </p>
            </div>
            <div className="relative w-full max-w-[600px] mx-auto">
              <div className="relative w-full aspect-[16/10] rounded-2xl shadow-2xl overflow-hidden border border-slate-200/60 bg-white p-4 md:p-5">
                <Image src="/screenshot-study-tools.png" fill className="object-contain" alt="Study tools screenshot" sizes="(max-width: 768px) 100vw, 600px" quality={95} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Chat Feature Section ────────────────────────────────────── */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div
            id="chat-section"
            data-reveal
            className={`grid lg:grid-cols-2 gap-16 items-center transition-all duration-700 ${isVisible('chat-section') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
          >
            {/* Left: Copy */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold mb-4" style={{ background: '#EEEDFE', color: '#3C3489' }}>
                AI chat assistant
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4 leading-tight">
                Ask anything about your semester
              </h2>
              <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                ClassMate knows your courses, your deadlines, and your materials. Ask it anything — it answers based on what's actually in your schedule.
              </p>
              <ul className="space-y-3">
                {[
                  'What\'s my heaviest week this semester?',
                  'Quiz me on the last chapter I uploaded',
                  'Summarize my FINC 400 notes in 5 bullets',
                  'When is my next exam and what do I need to study?',
                ].map((prompt) => (
                  <li key={prompt} className="flex items-start gap-3 text-sm text-slate-700">
                    <span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ background: '#5B4EE8' }} />
                    <span className="italic text-slate-600">"{prompt}"</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right: Chat UI mockup */}
            <div className="rounded-2xl border border-slate-200 shadow-xl overflow-hidden bg-white">
              {/* Chat header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ background: '#5B4EE8' }}>
                  CM
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">ClassMate AI</p>
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                    Online
                  </p>
                </div>
              </div>

              {/* Chat bubbles */}
              <div className="p-5 space-y-4 bg-[#F9FAFB]">
                {/* User */}
                <div className="flex justify-end">
                  <div className="max-w-[75%] rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-white" style={{ background: '#5B4EE8' }}>
                    What's my heaviest week this semester?
                  </div>
                </div>
                {/* AI */}
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-700 bg-white border border-slate-200 shadow-sm leading-relaxed">
                    Looking at your 4 courses — <strong>April 14–18</strong> is your busiest week. You have a FINC 400 final, an ENTR 360 presentation, and a FINC 382 quiz all in 5 days. Want me to build a study schedule for that week?
                  </div>
                </div>
                {/* User */}
                <div className="flex justify-end">
                  <div className="max-w-[75%] rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-white" style={{ background: '#5B4EE8' }}>
                    Yes, build me a study plan
                  </div>
                </div>
                {/* AI */}
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-700 bg-white border border-slate-200 shadow-sm leading-relaxed">
                    Done! I've broken it into daily blocks starting April 7. FINC 400 gets priority Mon/Wed, ENTR 360 prep on Tue/Thu, and FINC 382 review on the weekend. Added to your calendar. ✅
                  </div>
                </div>
              </div>

              {/* Fake input */}
              <div className="px-4 py-3 border-t border-slate-100 bg-white flex items-center gap-3">
                <input
                  readOnly
                  value=""
                  placeholder="Ask anything about your semester..."
                  className="flex-1 text-sm text-slate-500 bg-slate-50 rounded-xl border border-slate-200 px-4 py-2.5 outline-none cursor-default"
                />
                <button className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: '#5B4EE8' }}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ───────────────────────────────────────────── */}
      <section className="py-24 px-6" style={{ background: '#F7F7FB' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900">What students are saying</h2>
          </div>
          <div
            id="testimonials"
            data-reveal
            className={`grid md:grid-cols-3 gap-6 transition-all duration-700 ${isVisible('testimonials') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
          >
            {[
              {
                stars: 5,
                quote: "I uploaded my syllabus Sunday night and had my entire semester in my calendar by Monday morning. I never miss a deadline anymore.",
                name: 'Sarah C.',
                meta: 'Business, CofC · Junior',
                initials: 'SC',
                bg: '#5B4EE8',
              },
              {
                stars: 5,
                quote: "The AI chat is wild. I asked it to quiz me on my notes and it just did it. Feels like having a tutor available at 2am.",
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
            ].map((t) => (
              <div key={t.name} className="bg-white rounded-2xl border border-slate-200 p-7 shadow-sm flex flex-col gap-4">
                <div className="flex gap-0.5">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <svg key={i} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-slate-700 text-sm leading-relaxed italic flex-1">"{t.quote}"</p>
                <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: t.bg }}>
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.meta}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">Simple, honest pricing</h2>
            <p className="text-lg text-slate-500">Start free. Upgrade when you're ready.</p>
          </div>

          <div
            id="pricing"
            data-reveal
            className={`grid md:grid-cols-3 gap-6 items-start transition-all duration-700 ${isVisible('pricing') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
          >
            {/* Free */}
            <div className="rounded-2xl border border-slate-200 p-8 flex flex-col gap-6 bg-white">
              <div>
                <p className="text-sm font-semibold text-slate-500 mb-1">Free</p>
                <p className="text-4xl font-bold text-slate-900">$0 <span className="text-base font-normal text-slate-400">/forever</span></p>
              </div>
              <ul className="space-y-3 flex-1">
                {['3 courses', 'Syllabus deadline extraction', 'Calendar view', 'AI chat (20 messages/mo)', 'AI flashcards (50/mo)'].map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-slate-700">
                    <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => router.push('/signup')}
                className="w-full py-3 rounded-xl border-2 border-slate-200 text-sm font-semibold text-slate-700 hover:border-[#5B4EE8] hover:text-[#5B4EE8] transition-colors"
              >
                Get started free
              </button>
            </div>

            {/* Pro — Featured */}
            <div className="relative flex flex-col">
              <div className="flex justify-center mb-3">
                <span className="rounded-full px-4 py-1 text-xs font-bold text-white" style={{ background: '#5B4EE8' }}>
                  Most popular
                </span>
              </div>
              <div className="rounded-2xl p-8 flex flex-col gap-6 bg-white" style={{ border: '2px solid #5B4EE8' }}>
                <div>
                  <p className="text-sm font-semibold mb-1" style={{ color: '#5B4EE8' }}>Pro</p>
                  <p className="text-4xl font-bold text-slate-900">$8 <span className="text-base font-normal text-slate-400">/month</span></p>
                </div>
                <ul className="space-y-3 flex-1">
                  {['Unlimited courses', 'Unlimited AI chat', 'Unlimited flashcards & quizzes', 'Canvas + iCal sync', 'AI study summaries', 'Priority support'].map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-slate-700">
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: '#5B4EE8' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => router.push('/signup')}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                  style={{ background: '#5B4EE8' }}
                >
                  Start Pro — $8/mo
                </button>
              </div>
            </div>

            {/* Semester */}
            <div className="rounded-2xl border border-slate-200 p-8 flex flex-col gap-6 bg-white">
              <div>
                <p className="text-sm font-semibold text-slate-500 mb-1">Semester</p>
                <p className="text-4xl font-bold text-slate-900">$20 <span className="text-base font-normal text-slate-400">/semester</span></p>
              </div>
              <ul className="space-y-3 flex-1">
                {['Everything in Pro', 'Save 37% vs monthly', 'Semester-length access', 'Early access to new features'].map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-slate-700">
                    <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => router.push('/upgrade')}
                className="w-full py-3 rounded-xl border-2 border-slate-200 text-sm font-semibold text-slate-700 hover:border-[#5B4EE8] hover:text-[#5B4EE8] transition-colors"
              >
                Get semester plan
              </button>
            </div>
          </div>

          <p className="text-center text-sm text-slate-400 mt-8">No credit card required to start · Cancel anytime</p>
        </div>
      </section>

      {/* ── Trust / Privacy ────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-gradient-to-br from-slate-50 to-white">
        <div className="max-w-4xl mx-auto">
          <div
            id="trust"
            data-reveal
            className={`text-center transition-all duration-700 ${isVisible('trust') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
          >
            <div className="inline-flex items-center gap-2 bg-green-100 rounded-full px-4 py-2 mb-6">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-semibold text-green-700">Privacy-First</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Your data stays yours.</h2>
            <p className="text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto">
              We don't sell your data. We don't train AI models on your notes. ClassMate processes everything securely and privately — because your academic work belongs to you.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mt-12">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Encrypted Storage</h3>
              <p className="text-sm text-slate-600">Your files are encrypted at rest and in transit</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">No Data Selling</h3>
              <p className="text-sm text-slate-600">We make money from subscriptions, not your data</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">You Own Your Content</h3>
              <p className="text-sm text-slate-600">Export or delete your data anytime</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ─────────────────────────────────────────────── */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-3xl px-10 py-16 text-center text-white" style={{ background: '#5B4EE8' }}>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
              Your semester starts right now.
            </h2>
            <p className="text-lg mb-10 opacity-90 max-w-xl mx-auto">
              Join 47 students who stopped scrambling and started studying smarter.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => router.push('/signup')}
                className="px-10 py-4 text-base font-semibold bg-white rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all"
                style={{ color: '#5B4EE8' }}
              >
                Sign up free
              </button>
              <button
                onClick={() => router.push('/login')}
                className="px-10 py-4 text-base font-semibold text-white border-2 border-white/60 rounded-xl hover:bg-white/10 transition-all"
              >
                Log in
              </button>
            </div>
            <p className="mt-6 text-sm opacity-60">No credit card required · Takes 2 minutes to set up</p>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="bg-slate-900 text-white py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <img src="/brand/classmate-owl.png" alt="ClassMate" className="h-6 w-auto" />
            <span className="font-bold">ClassMate</span>
          </div>
          <div className="flex gap-6 text-sm text-slate-400">
            <a href="/privacy" className="hover:text-white transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-white transition-colors">Terms</a>
            <a href="mailto:leporatialex@gmail.com" className="hover:text-white transition-colors">Contact</a>
          </div>
          <div className="text-sm text-slate-400">© 2026 ClassMate. All rights reserved.</div>
        </div>
      </footer>

    </div>
  )
}
