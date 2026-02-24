'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Check } from 'lucide-react'

export default function LandingPage() {
  const router = useRouter()
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set())
  const observerRef = useRef<IntersectionObserver | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Hide global layout header & footer on mount
  useEffect(() => {
    document.body.classList.add('landing-page')
    return () => document.body.classList.remove('landing-page')
  }, [])

  // Scroll reveal observer
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

  const features = [
    {
      icon: '📄',
      title: 'Syllabus Parsing',
      desc: 'Upload a PDF. Every deadline extracted and added to your calendar automatically.',
    },
    {
      icon: '📅',
      title: 'Smart Calendar',
      desc: 'See what\'s due today, this week, and beyond. Never miss another assignment.',
    },
    {
      icon: '🔗',
      title: 'Canvas & iCal Sync',
      desc: 'Connect your LMS and school calendar. Assignments import in one click.',
    },
    {
      icon: '⚡',
      title: 'AI Flashcards',
      desc: 'Upload notes or slides. Get study-ready flashcards generated in seconds.',
    },
    {
      icon: '✍️',
      title: 'AI Quizzes',
      desc: 'Practice tests built from your actual course material. Know what to expect.',
    },
    {
      icon: '💬',
      title: 'AI Course Chat',
      desc: 'Ask questions about your courses, deadlines, and materials. Your personal tutor.',
    },
  ]

  const pricingFeatures = [
    { label: 'Courses', free: 'Unlimited', pro: 'Unlimited' },
    { label: 'Calendar & Deadlines', free: 'Full access', pro: 'Full access' },
    { label: 'Canvas / iCal Sync', free: 'Full access', pro: 'Full access' },
    { label: 'AI Flashcards', free: '5/month', pro: 'Unlimited' },
    { label: 'AI Quizzes', free: '5/month', pro: 'Unlimited' },
    { label: 'AI Summaries', free: '5/month', pro: 'Unlimited' },
    { label: 'AI Course Chat', free: '—', pro: '50 msgs/week' },
  ]

  return (
    <>
      {/* Fonts & global overrides for landing page */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:ital,opsz,wght@0,9..40,300..700;1,9..40,300..700&display=swap');

        body.landing-page > header,
        body.landing-page > .auth-wrapper > header,
        body.landing-page > footer,
        body.landing-page > .auth-wrapper > footer {
          display: none !important;
        }
        body.landing-page > .auth-wrapper > button[class*="feedback"] {
          display: none !important;
        }
        body.landing-page {
          background: #f5f2ec !important;
        }

        .font-serif-display {
          font-family: 'Instrument Serif', Georgia, serif;
        }
        .font-body {
          font-family: 'DM Sans', system-ui, sans-serif;
        }

        @keyframes float-slow {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(1deg); }
        }
        @keyframes float-medium {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-18px) rotate(-1.5deg); }
        }
        @keyframes float-fast {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        .animate-float-slow { animation: float-slow 6s ease-in-out infinite; }
        .animate-float-medium { animation: float-medium 5s ease-in-out infinite; }
        .animate-float-fast { animation: float-fast 4s ease-in-out infinite; }
      `}</style>

      <div className="font-body text-[#0d0d0d] bg-[#f5f2ec] min-h-screen">
        {/* ─── Navigation ─── */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-[#f5f2ec]/80 backdrop-blur-xl border-b border-[#0d0d0d]/5">
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <img src="/brand/classmate-owl.png" alt="ClassMate" className="h-8 w-auto" />
              <span className="font-serif-display text-xl text-[#0d0d0d]">ClassMate</span>
            </Link>
            {/* Desktop */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#how-it-works" className="text-sm font-medium text-[#0d0d0d]/60 hover:text-[#0d0d0d] transition-colors">How It Works</a>
              <a href="#features" className="text-sm font-medium text-[#0d0d0d]/60 hover:text-[#0d0d0d] transition-colors">Features</a>
              <a href="#pricing" className="text-sm font-medium text-[#0d0d0d]/60 hover:text-[#0d0d0d] transition-colors">Pricing</a>
              <button onClick={() => router.push('/login')} className="text-sm font-medium text-[#0d0d0d]/60 hover:text-[#0d0d0d] transition-colors">
                Log in
              </button>
              <button
                onClick={() => router.push('/signup')}
                className="px-5 py-2 text-sm font-semibold text-white bg-[#4f46e5] rounded-lg hover:bg-[#4338ca] transition-colors"
              >
                Get Started Free
              </button>
            </div>
            {/* Mobile menu button */}
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div className="md:hidden bg-[#f5f2ec]/95 backdrop-blur-xl border-t border-[#0d0d0d]/5 px-6 py-4 space-y-3">
              <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-medium text-[#0d0d0d]/70">How It Works</a>
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-medium text-[#0d0d0d]/70">Features</a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-medium text-[#0d0d0d]/70">Pricing</a>
              <button onClick={() => router.push('/login')} className="block text-sm font-medium text-[#0d0d0d]/70">Log in</button>
              <button onClick={() => router.push('/signup')} className="w-full px-5 py-2.5 text-sm font-semibold text-white bg-[#4f46e5] rounded-lg">
                Get Started Free
              </button>
            </div>
          )}
        </nav>

        {/* ─── Hero ─── */}
        <section className="pt-28 pb-20 md:pt-36 md:pb-28 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              {/* Left: Copy */}
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-[#4f46e5]/10 px-4 py-1.5 text-sm font-medium text-[#4f46e5] mb-6">
                  <span className="w-2 h-2 rounded-full bg-[#4f46e5] animate-pulse" />
                  Built for college students
                </div>
                <h1 className="font-serif-display text-5xl md:text-6xl lg:text-7xl leading-[1.05] tracking-tight text-[#0d0d0d] mb-6">
                  Quizlet that knows your{' '}
                  <span className="italic text-[#4f46e5]">deadlines.</span>
                </h1>
                <p className="text-lg md:text-xl text-[#0d0d0d]/60 leading-relaxed mb-10 max-w-lg">
                  Upload your syllabus. Get AI-powered flashcards, quizzes, and a calendar that actually keeps you on track.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={() => router.push('/signup')}
                    className="px-8 py-4 text-base font-semibold text-white bg-[#4f46e5] rounded-xl shadow-lg shadow-[#4f46e5]/25 hover:bg-[#4338ca] hover:shadow-xl hover:shadow-[#4f46e5]/30 hover:-translate-y-0.5 transition-all"
                  >
                    Start Free Today
                  </button>
                  <button
                    onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
                    className="px-8 py-4 text-base font-semibold text-[#0d0d0d] bg-white/60 border border-[#0d0d0d]/10 rounded-xl hover:bg-white hover:border-[#0d0d0d]/20 transition-all"
                  >
                    See How It Works
                  </button>
                </div>
                <p className="mt-5 text-sm text-[#0d0d0d]/40">No credit card required</p>
              </div>

              {/* Right: Hero mockup with floating cards */}
              <div className="relative flex justify-center items-center">
                <div className="relative w-full max-w-[480px]">
                  {/* Main phone mockup */}
                  <div
                    className="relative"
                    style={{
                      WebkitMaskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,1) 65%, rgba(0,0,0,0.9) 80%, rgba(0,0,0,0) 98%)',
                      maskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,1) 65%, rgba(0,0,0,0.9) 80%, rgba(0,0,0,0) 98%)',
                    }}
                  >
                    <Image
                      src="/hero.png"
                      alt="ClassMate app preview"
                      width={546}
                      height={777}
                      className="select-none w-full h-auto"
                      priority
                    />
                  </div>
                  {/* Floating card 1 - Calendar event */}
                  <div className="absolute -left-8 top-1/4 animate-float-slow hidden lg:block">
                    <div className="bg-white rounded-xl shadow-lg shadow-black/5 px-4 py-3 border border-[#0d0d0d]/5">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-400" />
                        <span className="text-xs font-semibold text-[#0d0d0d]">Exam — Ch. 4-6</span>
                      </div>
                      <p className="text-[10px] text-[#0d0d0d]/50 mt-1">Tomorrow, 2:30 PM</p>
                    </div>
                  </div>
                  {/* Floating card 2 - AI generation */}
                  <div className="absolute -right-6 top-1/3 animate-float-medium hidden lg:block">
                    <div className="bg-white rounded-xl shadow-lg shadow-black/5 px-4 py-3 border border-[#0d0d0d]/5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">⚡</span>
                        <span className="text-xs font-semibold text-[#0d0d0d]">24 flashcards ready</span>
                      </div>
                      <p className="text-[10px] text-[#0d0d0d]/50 mt-1">From Biology Notes.pdf</p>
                    </div>
                  </div>
                  {/* Floating card 3 - Quiz score */}
                  <div className="absolute -left-4 bottom-1/4 animate-float-fast hidden lg:block">
                    <div className="bg-white rounded-xl shadow-lg shadow-black/5 px-4 py-3 border border-[#0d0d0d]/5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">✅</span>
                        <span className="text-xs font-semibold text-[#0d0d0d]">Quiz: 18/20</span>
                      </div>
                      <p className="text-[10px] text-[#0d0d0d]/50 mt-1">Organic Chemistry</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Trust Bar ─── */}
        <section className="py-8 px-6 border-y border-[#0d0d0d]/5">
          <div className="max-w-4xl mx-auto flex flex-wrap justify-center items-center gap-x-12 gap-y-4 text-sm text-[#0d0d0d]/40">
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
              Encrypted & Private
            </span>
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Set up in 2 minutes
            </span>
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
              Free forever plan
            </span>
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Works with Canvas
            </span>
          </div>
        </section>

        {/* ─── Pain Section ─── */}
        <section className="py-24 px-6 bg-[#0d0d0d] text-white">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <h2 className="font-serif-display text-3xl md:text-5xl leading-tight mb-4">
              You&apos;re not dumb.<br />
              <span className="text-white/50">Your tools are broken.</span>
            </h2>
          </div>
          <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
            {[
              {
                id: 'pain-1',
                quote: '"I got a zero on an exam I didn\'t know existed."',
                detail: 'The quiz was buried in Canvas, hidden in a syllabus PDF, or posted in an announcement you never saw.',
              },
              {
                id: 'pain-2',
                quote: '"Too many platforms. No direction."',
                detail: 'Canvas. Google Drive. Email. Slides. PDFs. Nothing shows what actually matters next.',
              },
              {
                id: 'pain-3',
                quote: '"I waste more time organizing than studying."',
                detail: 'Constantly rewriting notes, making flashcards, and sorting deadlines instead of learning.',
              },
            ].map((pain, i) => (
              <div
                key={pain.id}
                id={pain.id}
                data-reveal
                className={`transition-all duration-700 ${i === 1 ? 'delay-150' : i === 2 ? 'delay-300' : ''} ${
                  isVisible(pain.id) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
              >
                <div className="rounded-2xl border border-white/10 bg-white/5 p-8 h-full flex flex-col justify-between backdrop-blur-sm">
                  <h3 className="font-serif-display text-xl leading-snug mb-4">{pain.quote}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{pain.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── How It Works ─── */}
        <section id="how-it-works" className="py-24 px-6">
          <div className="max-w-4xl mx-auto text-center mb-20">
            <p className="text-sm font-semibold uppercase tracking-widest text-[#4f46e5] mb-3">How It Works</p>
            <h2 className="font-serif-display text-4xl md:text-5xl tracking-tight">
              Four steps. That&apos;s it.
            </h2>
          </div>

          <div className="max-w-5xl mx-auto space-y-24">
            {[
              {
                id: 'step-1',
                step: '01',
                label: 'Upload your syllabus',
                title: 'Drop a PDF. We\'ll read it for you.',
                desc: 'ClassMate extracts every deadline — quizzes, exams, assignments, projects — and adds them to your calendar automatically.',
                image: '/screenshot-course-upload.png',
                imageAlt: 'Upload syllabus screenshot',
              },
              {
                id: 'step-2',
                step: '02',
                label: 'Get your calendar',
                title: 'Every deadline, automatically organized.',
                desc: 'See what\'s due today, this week, and this month. Never miss another assignment, quiz, or exam.',
                image: '/screenshot-calendar.png',
                imageAlt: 'Calendar view screenshot',
                reverse: true,
              },
              {
                id: 'step-3',
                step: '03',
                label: 'Sync your LMS',
                title: 'Connect Canvas or iCal in one click.',
                desc: 'Already have assignments in Canvas or your school calendar? Connect and ClassMate imports every due date — no manual entry.',
                image: '/screenshot-course-upload.png',
                imageAlt: 'LMS sync screenshot',
              },
              {
                id: 'step-4',
                step: '04',
                label: 'Study smarter',
                title: 'AI flashcards & quizzes in seconds.',
                desc: 'Upload lecture notes, slides, or readings. ClassMate generates flashcards, practice quizzes, and summaries instantly.',
                image: '/screenshot-study-tools.png',
                imageAlt: 'Study tools screenshot',
                reverse: true,
              },
            ].map((s) => (
              <div
                key={s.id}
                id={s.id}
                data-reveal
                className={`grid md:grid-cols-2 gap-12 items-center transition-all duration-700 ${
                  isVisible(s.id) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
                }`}
              >
                <div className={s.reverse ? 'md:order-2' : ''}>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="font-serif-display text-3xl text-[#4f46e5]/30">{s.step}</span>
                    <span className="text-sm font-semibold text-[#0d0d0d]/50 uppercase tracking-wider">{s.label}</span>
                  </div>
                  <h3 className="font-serif-display text-2xl md:text-3xl text-[#0d0d0d] mb-4 leading-snug">{s.title}</h3>
                  <p className="text-[#0d0d0d]/60 leading-relaxed">{s.desc}</p>
                </div>
                <div className={`relative w-full max-w-[560px] mx-auto ${s.reverse ? 'md:order-1' : ''}`}>
                  <div className="relative w-full aspect-[16/10] rounded-2xl shadow-xl overflow-hidden border border-[#0d0d0d]/5 bg-white">
                    <Image
                      src={s.image}
                      fill
                      className="object-contain p-4"
                      alt={s.imageAlt}
                      sizes="(max-width: 768px) 100vw, 560px"
                      quality={90}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Features Grid ─── */}
        <section id="features" className="py-24 px-6 bg-white">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <p className="text-sm font-semibold uppercase tracking-widest text-[#4f46e5] mb-3">Features</p>
            <h2 className="font-serif-display text-4xl md:text-5xl tracking-tight">
              Everything you need to{' '}
              <span className="italic">ace</span> the semester.
            </h2>
          </div>

          <div className="max-w-5xl mx-auto grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div
                key={f.title}
                id={`feat-${i}`}
                data-reveal
                className={`transition-all duration-500 ${
                  isVisible(`feat-${i}`) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
                style={{ transitionDelay: `${i * 75}ms` }}
              >
                <div className="rounded-2xl border border-[#0d0d0d]/5 bg-[#f5f2ec]/50 p-6 h-full hover:border-[#4f46e5]/20 hover:shadow-sm transition-all">
                  <span className="text-2xl mb-3 block">{f.icon}</span>
                  <h3 className="font-semibold text-[#0d0d0d] mb-2">{f.title}</h3>
                  <p className="text-sm text-[#0d0d0d]/50 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Video Section ─── */}
        <section className="py-24 px-6">
          <div className="max-w-4xl mx-auto text-center mb-12">
            <p className="text-sm font-semibold uppercase tracking-widest text-[#4f46e5] mb-3">See It In Action</p>
            <h2 className="font-serif-display text-4xl md:text-5xl tracking-tight">
              Watch how ClassMate works.
            </h2>
          </div>
          <div
            id="video-section"
            data-reveal
            className={`max-w-4xl mx-auto transition-all duration-700 ${
              isVisible('video-section') ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
          >
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-2xl border border-[#0d0d0d]/5 bg-[#0d0d0d]">
              <video
                className="w-full h-full object-cover"
                controls
                playsInline
                preload="metadata"
                poster="/hero.png"
              >
                <source src="/demo.mp4" type="video/mp4" />
                <source src="/demo.mov" type="video/quicktime" />
                {/* Fallback */}
                <div className="flex items-center justify-center w-full h-full text-white/50 text-sm">
                  Video coming soon
                </div>
              </video>
            </div>
          </div>
        </section>

        {/* ─── Pricing ─── */}
        <section id="pricing" className="py-24 px-6 bg-white">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <p className="text-sm font-semibold uppercase tracking-widest text-[#4f46e5] mb-3">Pricing</p>
            <h2 className="font-serif-display text-4xl md:text-5xl tracking-tight mb-4">
              Simple, student-friendly pricing.
            </h2>
            <p className="text-lg text-[#0d0d0d]/50 max-w-md mx-auto">
              Start free. Upgrade when you need unlimited AI tools.
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            {/* Pricing cards */}
            <div className="grid md:grid-cols-2 gap-6 mb-12">
              {/* Free */}
              <div className="rounded-2xl border border-[#0d0d0d]/10 bg-[#f5f2ec] p-8">
                <h3 className="font-semibold text-lg text-[#0d0d0d] mb-1">Free</h3>
                <p className="text-sm text-[#0d0d0d]/50 mb-6">Everything you need to get started</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-[#0d0d0d]">$0</span>
                  <span className="text-[#0d0d0d]/40 text-sm"> /forever</span>
                </div>
                <button
                  onClick={() => router.push('/signup')}
                  className="w-full py-3 rounded-xl border-2 border-[#0d0d0d]/10 text-sm font-semibold text-[#0d0d0d] hover:border-[#0d0d0d]/30 transition-colors"
                >
                  Get Started
                </button>
              </div>

              {/* Pro */}
              <div className="relative rounded-2xl border-2 border-[#4f46e5] bg-white p-8 shadow-lg shadow-[#4f46e5]/5">
                <div className="absolute -top-3 right-6 rounded-full bg-[#4f46e5] px-3 py-0.5 text-xs font-bold text-white">
                  Most Popular
                </div>
                <h3 className="font-semibold text-lg text-[#0d0d0d] mb-1">Pro</h3>
                <p className="text-sm text-[#0d0d0d]/50 mb-6">Unlimited AI-powered study tools</p>
                <div className="mb-1">
                  <span className="text-4xl font-bold text-[#0d0d0d]">$4.99</span>
                  <span className="text-[#0d0d0d]/40 text-sm"> /month</span>
                </div>
                <p className="text-xs text-[#0d0d0d]/40 mb-6">or $39.99/year (save 33%)</p>
                <button
                  onClick={() => router.push('/signup')}
                  className="w-full py-3 rounded-xl bg-[#4f46e5] text-sm font-semibold text-white hover:bg-[#4338ca] transition-colors shadow-sm"
                >
                  Start 10-Day Free Trial
                </button>
                <p className="mt-2 text-center text-xs text-[#0d0d0d]/40">No credit card required</p>
              </div>
            </div>

            {/* Feature comparison table */}
            <div
              id="pricing-table"
              data-reveal
              className={`rounded-2xl border border-[#0d0d0d]/5 bg-[#f5f2ec]/50 p-6 transition-all duration-700 ${
                isVisible('pricing-table') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
            >
              <h3 className="text-sm font-semibold uppercase tracking-widest text-[#0d0d0d]/30 mb-4">What you get</h3>
              <div className="divide-y divide-[#0d0d0d]/5">
                <div className="grid grid-cols-3 gap-4 pb-3 text-xs font-semibold text-[#0d0d0d]/40">
                  <span>Feature</span>
                  <span className="text-center">Free</span>
                  <span className="text-center text-[#4f46e5]">Pro</span>
                </div>
                {pricingFeatures.map((f) => (
                  <div key={f.label} className="grid grid-cols-3 gap-4 py-3 text-sm">
                    <span className="font-medium text-[#0d0d0d]/70">{f.label}</span>
                    <span className="text-center text-[#0d0d0d]/40">{f.free}</span>
                    <span className="text-center font-semibold text-[#4f46e5]">
                      {f.pro === 'Unlimited' ? (
                        <span className="inline-flex items-center gap-1">
                          <Check size={14} />
                          {f.pro}
                        </span>
                      ) : (
                        f.pro
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ─── Testimonials ─── */}
        <section className="py-24 px-6">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <p className="text-sm font-semibold uppercase tracking-widest text-[#4f46e5] mb-3">Testimonials</p>
            <h2 className="font-serif-display text-4xl md:text-5xl tracking-tight">
              Students love ClassMate.
            </h2>
          </div>
          <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
            {[
              {
                id: 'test-1',
                quote: 'I uploaded my syllabus and had every deadline on my calendar in literally 30 seconds. Game changer.',
                name: 'Sarah K.',
                school: 'UNC Charlotte',
              },
              {
                id: 'test-2',
                quote: 'The AI flashcards are insane. I used to spend hours making Quizlet sets — now it takes seconds.',
                name: 'Marcus T.',
                school: 'College of Charleston',
              },
              {
                id: 'test-3',
                quote: 'I went from missing assignments every week to having everything organized. My GPA literally went up.',
                name: 'Jordan L.',
                school: 'Clemson University',
              },
            ].map((t, i) => (
              <div
                key={t.id}
                id={t.id}
                data-reveal
                className={`transition-all duration-500 ${
                  isVisible(t.id) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div className="rounded-2xl border border-[#0d0d0d]/5 bg-white p-6 h-full flex flex-col">
                  <div className="flex gap-1 mb-4">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <svg key={s} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-sm text-[#0d0d0d]/70 leading-relaxed flex-1 italic">&ldquo;{t.quote}&rdquo;</p>
                  <div className="mt-4 pt-4 border-t border-[#0d0d0d]/5">
                    <p className="text-sm font-semibold text-[#0d0d0d]">{t.name}</p>
                    <p className="text-xs text-[#0d0d0d]/40">{t.school}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Final CTA ─── */}
        <section className="py-24 px-6 bg-[#0d0d0d]">
          <div className="max-w-3xl mx-auto text-center text-white">
            <h2 className="font-serif-display text-4xl md:text-5xl mb-6 leading-tight">
              Start studying smarter.<br />
              <span className="text-white/50">It&apos;s free.</span>
            </h2>
            <p className="text-lg text-white/50 mb-10 max-w-md mx-auto">
              Join thousands of students who stopped drowning in deadlines and started acing their classes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => router.push('/signup')}
                className="px-10 py-4 text-base font-semibold bg-[#4f46e5] text-white rounded-xl shadow-lg shadow-[#4f46e5]/25 hover:bg-[#4338ca] hover:-translate-y-0.5 transition-all"
              >
                Sign Up Free
              </button>
              <button
                onClick={() => router.push('/login')}
                className="px-10 py-4 text-base font-semibold text-white border border-white/20 rounded-xl hover:bg-white/5 transition-all"
              >
                Log In
              </button>
            </div>
            <p className="mt-6 text-sm text-white/30">No credit card required • Free forever plan available</p>
          </div>
        </section>

        {/* ─── Footer ─── */}
        <footer className="bg-[#0d0d0d] border-t border-white/5 text-white py-12 px-6">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2.5">
              <img src="/brand/classmate-owl.png" alt="ClassMate" className="h-6 w-auto brightness-200" />
              <span className="font-serif-display text-lg">ClassMate</span>
            </div>
            <div className="flex gap-6 text-sm text-white/40">
              <a href="/privacy" className="hover:text-white transition-colors">Privacy</a>
              <a href="/terms" className="hover:text-white transition-colors">Terms</a>
              <a href="mailto:leporatialex@gmail.com" className="hover:text-white transition-colors">Contact</a>
            </div>
            <div className="text-sm text-white/30">&copy; 2026 ClassMate. All rights reserved.</div>
          </div>
        </footer>
      </div>
    </>
  )
}
