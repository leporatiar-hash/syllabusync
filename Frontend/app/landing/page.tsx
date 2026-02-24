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
      { threshold: 0.2 }
    )

    document.querySelectorAll('[data-reveal]').forEach((el) => {
      observerRef.current?.observe(el)
    })

    return () => observerRef.current?.disconnect()
  }, [])

  const isVisible = (id: string) => visibleSections.has(id)

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-[#F8FAFF] to-[#EEF2FF]">
      {/* Navigation */}
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
              className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-[#5B8DEF] to-[#A78BFA] rounded-lg shadow-sm hover:opacity-90 transition-opacity"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 bg-white w-full">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Copy */}
            <div
              className="transition-all duration-1000"
              style={{
                opacity: Math.min(1, 1 - scrollY / 500),
                transform: `translateY(${scrollY * 0.3}px)`,
              }}
            >
              <h1 className="text-5xl md:text-6xl font-bold text-slate-900 leading-tight mb-6">
                Quizlet that knows your{' '}
                <span className="bg-gradient-to-r from-[#5B8DEF] to-[#A78BFA] bg-clip-text text-transparent">
                  deadlines.
                </span>
              </h1>
              <p className="text-xl text-slate-600 mb-8 leading-relaxed">
                Upload your syllabus and course material. Get AI-powered flashcards, quizzes, and a calendar that actually keeps you on track.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => router.push('/signup')}
                  className="px-8 py-4 text-lg font-semibold text-white bg-gradient-to-r from-[#5B8DEF] to-[#A78BFA] rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all"
                >
                  Start Free Today
                </button>
                <button
                  onClick={() => {
                    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })
                  }}
                  className="px-8 py-4 text-lg font-semibold text-slate-700 bg-white border-2 border-slate-200 rounded-xl hover:border-[#5B8DEF] transition-colors"
                >
                  See How It Works
                </button>
              </div>
            </div>

            {/* Right: Hero Image */}
            <div
              className="relative flex justify-center items-center transition-all duration-1000"
              style={{
                transform: `translateY(${scrollY * 0.2}px)`,
              }}
            >
              {/* phone image blended into pure white */}
              <div className="relative">
                <div className="pointer-events-none absolute -inset-10 rounded-[48px] bg-[radial-gradient(70%_70%_at_50%_40%,rgba(255,255,255,0.95),rgba(255,255,255,0.6),rgba(255,255,255,0))] blur-2xl" />
                <div
                  className="relative"
                  style={{
                    WebkitMaskImage:
                      "radial-gradient(ellipse at center, rgba(0,0,0,1) 68%, rgba(0,0,0,0.94) 84%, rgba(0,0,0,0) 98%)",
                    maskImage:
                      "radial-gradient(ellipse at center, rgba(0,0,0,1) 68%, rgba(0,0,0,0.94) 84%, rgba(0,0,0,0) 98%)",
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

      {/* Problem Section */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            You're not dumb.
            <br />
            <span className="text-slate-500">The tools and systems you are given to succeed are broken.</span>
          </h2>
        </div>

        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
          {/* Pain Point 1 */}
          <div
            id="pain-1"
            data-reveal
            className={`transition-all duration-700 ${
              isVisible('pain-1') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
            }`}
          >
            <div className="rounded-2xl p-8 h-full min-h-[220px] bg-gradient-to-br from-white via-[#F4F8FF] to-[#EAF2FF] border border-[#D6E6FF] shadow-sm flex flex-col justify-between">
              <h3 className="text-lg font-bold text-slate-900 mb-3 leading-snug">"I got a zero on an exam I didn't know existed."</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                The quiz was buried in Canvas, hidden in a syllabus PDF, or posted in an announcement I never saw.
              </p>
            </div>
          </div>

          {/* Pain Point 2 */}
          <div
            id="pain-2"
            data-reveal
            className={`transition-all duration-700 delay-150 ${
              isVisible('pain-2') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
            }`}
          >
            <div className="rounded-2xl p-8 h-full min-h-[220px] bg-gradient-to-br from-white via-[#F4F8FF] to-[#EAF2FF] border border-[#D6E6FF] shadow-sm flex flex-col justify-between">
              <h3 className="text-lg font-bold text-slate-900 mb-3 leading-snug">"Too many platforms. No direction."</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Canvas. Google Drive. Email. Slides. PDFs. Group chats. Nothing shows what actually matters next.
              </p>
            </div>
          </div>

          {/* Pain Point 3 */}
          <div
            id="pain-3"
            data-reveal
            className={`transition-all duration-700 delay-300 ${
              isVisible('pain-3') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
            }`}
          >
            <div className="rounded-2xl p-8 h-full min-h-[220px] bg-gradient-to-br from-white via-[#F4F8FF] to-[#EAF2FF] border border-[#D6E6FF] shadow-sm flex flex-col justify-between">
              <h3 className="text-lg font-bold text-slate-900 mb-3 leading-snug">"I waste more time organizing than studying."</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                I'm constantly rewriting notes, making flashcards, and sorting deadlines instead of learning the material.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
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
            className={`grid md:grid-cols-2 gap-12 items-center transition-all duration-700 ${
              isVisible('step-1') ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-12'
            }`}
          >
            <div>
              <div className="inline-flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-sm mb-4">
                <span className="w-6 h-6 rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#A78BFA] text-white text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <span className="text-sm font-semibold text-slate-900">Upload your syllabus</span>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">
                Drop a PDF. We'll read it for you.
              </h3>
              <p className="text-slate-600 leading-relaxed">
                ClassMate extracts every deadline — quizzes, exams, assignments, projects — and adds them to your
                personal calendar automatically.
              </p>
            </div>
            <div className="relative w-full max-w-[600px] mx-auto">
              <div className="relative w-full aspect-[16/10] rounded-2xl shadow-2xl overflow-hidden border border-slate-200/60 bg-white p-4 md:p-5">
                <Image
                  src="/screenshot-course-upload.png"
                  fill
                  className="object-contain"
                  alt="Upload syllabus screenshot"
                  sizes="(max-width: 768px) 100vw, 600px"
                  quality={95}
                />
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div
            id="step-2"
            data-reveal
            className={`grid md:grid-cols-2 gap-12 items-center transition-all duration-700 ${
              isVisible('step-2') ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'
            }`}
          >
            <div className="order-2 md:order-1">
              <div className="relative w-full max-w-[600px] mx-auto">
                <div className="relative w-full aspect-[16/10] rounded-2xl shadow-2xl overflow-hidden border border-slate-200/60 bg-white p-4 md:p-5">
                  <Image
                    src="/screenshot-calendar.png"
                    fill
                    className="object-contain"
                    alt="Calendar view screenshot"
                    sizes="(max-width: 768px) 100vw, 600px"
                    quality={95}
                  />
                </div>
              </div>
            </div>
            <div className="order-1 md:order-2">
              <div className="inline-flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-sm mb-4">
                <span className="w-6 h-6 rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#A78BFA] text-white text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <span className="text-sm font-semibold text-slate-900">Get your calendar</span>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">
                Every deadline, automatically organized.
              </h3>
              <p className="text-slate-600 leading-relaxed">
                See what's due today, this week, and this month. Never miss another assignment, quiz, or exam.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div
            id="step-3"
            data-reveal
            className={`grid md:grid-cols-2 gap-12 items-center transition-all duration-700 ${
              isVisible('step-3') ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-12'
            }`}
          >
            <div>
              <div className="inline-flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-sm mb-4">
                <span className="w-6 h-6 rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#A78BFA] text-white text-xs font-bold flex items-center justify-center">
                  3
                </span>
                <span className="text-sm font-semibold text-slate-900">Study smarter</span>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">
                AI-powered flashcards & quizzes in seconds.
              </h3>
              <p className="text-slate-600 leading-relaxed">
                Upload lecture notes, slides, or readings. ClassMate generates flashcards, practice quizzes, and study
                summaries instantly.
              </p>
            </div>
            <div className="relative w-full max-w-[600px] mx-auto">
              <div className="relative w-full aspect-[16/10] rounded-2xl shadow-2xl overflow-hidden border border-slate-200/60 bg-white p-4 md:p-5">
                <Image
                  src="/screenshot-study-tools.png"
                  fill
                  className="object-contain"
                  alt="Study tools screenshot"
                  sizes="(max-width: 768px) 100vw, 600px"
                  quality={95}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Cards - Input → Output */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-4xl mx-auto text-center mb-20">
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight">
            Input → Output
          </h2>
        </div>

        <div className="max-w-4xl mx-auto space-y-6">
          {/* Feature 1 - Study Smart */}
          <div
            id="feature-1"
            data-reveal
            onClick={() => router.push('/signup')}
            className={`bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-[#5B8DEF] cursor-pointer transition-all duration-700 ${
              isVisible('feature-1') ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
          >
            <div className="flex items-center gap-6 p-8">
              <div className="flex-1">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Input</div>
                <div className="text-xl font-bold text-slate-900">Course Material</div>
                <p className="text-sm text-slate-500 mt-1">PDFs, slides, notes, readings</p>
              </div>
              <div className="text-2xl text-slate-300 font-light">→</div>
              <div className="flex-1">
                <div className="text-xs font-semibold text-[#5B8DEF] uppercase tracking-wider mb-2">Output</div>
                <div className="text-xl font-bold text-slate-900">Study Tools</div>
                <p className="text-sm text-slate-500 mt-1">AI flashcards, quizzes, summaries</p>
              </div>
            </div>
          </div>

          {/* Feature 2 - Parse Syllabi / Stay Organized */}
          <div
            id="feature-2"
            data-reveal
            onClick={() => router.push('/signup')}
            className={`bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-[#5B8DEF] cursor-pointer transition-all duration-700 delay-100 ${
              isVisible('feature-2') ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
          >
            <div className="flex items-center gap-6 p-8">
              <div className="flex-1">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Input</div>
                <div className="text-xl font-bold text-slate-900">Syllabus PDF</div>
                <p className="text-sm text-slate-500 mt-1">20-page document, scattered dates</p>
              </div>
              <div className="text-2xl text-slate-300 font-light">→</div>
              <div className="flex-1">
                <div className="text-xs font-semibold text-[#5B8DEF] uppercase tracking-wider mb-2">Output</div>
                <div className="text-xl font-bold text-slate-900">Smart Calendar</div>
                <p className="text-sm text-slate-500 mt-1">Every deadline extracted, organized</p>
              </div>
            </div>
          </div>

          {/* Feature 3 */}
          <div
            id="feature-3"
            data-reveal
            className={`bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-700 delay-200 ${
              isVisible('feature-3') ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
          >
            <div className="flex items-center gap-6 p-8">
              <div className="flex-1">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Coming Soon</div>
                <div className="text-xl font-bold text-slate-900">Connect with Classmates</div>
                <p className="text-sm text-slate-500 mt-1">Based on class, professor, or major</p>
              </div>
              <div className="text-2xl text-slate-300 font-light">→</div>
              <div className="flex-1">
                <div className="text-xs font-semibold text-[#5B8DEF] uppercase tracking-wider mb-2">Output</div>
                <div className="text-xl font-bold text-slate-900">Survive the Semester Together</div>
                <p className="text-sm text-slate-500 mt-1">
                  Real student advice, professor tips, and instant help when you're stuck.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-20 px-6 bg-gradient-to-br from-slate-50 to-white">
        <div className="max-w-4xl mx-auto">
          <div
            id="trust"
            data-reveal
            className={`text-center transition-all duration-700 ${
              isVisible('trust') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
            }`}
          >
            <div className="inline-flex items-center gap-2 bg-green-100 rounded-full px-4 py-2 mb-6">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-sm font-semibold text-green-700">Privacy-First</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Your data stays yours.</h2>
            <p className="text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto">
              We don't sell your data. We don't train AI models on your notes. ClassMate processes everything securely
              and privately — because your academic work belongs to you.
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

      {/* Final CTA */}
      <section className="py-20 px-6 bg-gradient-to-br from-[#5B8DEF] to-[#A78BFA]">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Sign up now for free</h2>
          <p className="text-xl mb-8 opacity-90">Become a founding member.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => router.push('/signup')}
              className="px-10 py-4 text-lg font-semibold bg-white text-[#5B8DEF] rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all"
            >
              Sign Up
            </button>
            <button
              onClick={() => router.push('/login')}
              className="px-10 py-4 text-lg font-semibold text-white border-2 border-white rounded-xl hover:bg-white/10 transition-all"
            >
              Log In
            </button>
          </div>
          <p className="mt-6 text-sm opacity-75">No credit card required • Start free today</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <img src="/brand/classmate-owl.png" alt="ClassMate" className="h-6 w-auto" />
            <span className="font-bold">ClassMate</span>
          </div>
          <div className="flex gap-6 text-sm text-slate-400">
            <a href="/privacy" className="hover:text-white transition-colors">
              Privacy
            </a>
            <a href="/terms" className="hover:text-white transition-colors">
              Terms
            </a>
            <a href="mailto:leporatialex@gmail.com" className="hover:text-white transition-colors">
              Contact
            </a>
          </div>
          <div className="text-sm text-slate-400">© 2026 ClassMate. All rights reserved.</div>
        </div>
      </footer>
    </div>
  )
}
