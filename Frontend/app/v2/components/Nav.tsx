'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BRAND, navLinks } from './tokens'

export default function Nav() {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const handleAnchorClick = (href: string) => {
    setOpen(false)
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2" aria-label="ClassMate home">
          <img src="/brand/classmate-owl.png" alt="" className="h-8 w-auto" />
          <span className="text-xl font-bold text-slate-900">ClassMate</span>
        </a>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <button
              key={link.href}
              onClick={() => handleAnchorClick(link.href)}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              {link.label}
            </button>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-4">
          <button
            onClick={() => router.push('/login')}
            className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            Log in
          </button>
          <button
            onClick={() => router.push('/signup')}
            className="px-5 py-2 text-sm font-semibold text-white rounded-lg shadow-sm hover:opacity-90 transition-opacity"
            style={{ background: BRAND }}
          >
            Get Started
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="md:hidden flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="v2-mobile-menu"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div id="v2-mobile-menu" className="md:hidden border-t border-slate-200 bg-white px-6 py-4">
          <div className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <button
                key={link.href}
                onClick={() => handleAnchorClick(link.href)}
                className="text-left text-sm font-medium text-slate-700 hover:text-slate-900"
              >
                {link.label}
              </button>
            ))}
            <div className="flex flex-col gap-3 pt-2 border-t border-slate-100">
              <button
                onClick={() => { setOpen(false); router.push('/login') }}
                className="text-left text-sm font-medium text-slate-600"
              >
                Log in
              </button>
              <button
                onClick={() => { setOpen(false); router.push('/signup') }}
                className="w-full px-5 py-2.5 text-sm font-semibold text-white rounded-lg shadow-sm"
                style={{ background: BRAND }}
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
