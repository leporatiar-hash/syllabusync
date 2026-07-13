'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Nav from './Nav'
import FeedbackButton from './FeedbackButton'
import AuthDebug from './AuthDebug'

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // The homepage and /v2 render their own full nav + footer (built for the
  // logged-out marketing page), so the global chrome would otherwise double up.
  const isStandalonePage = pathname === '/' || pathname?.startsWith('/v2')

  const buildId = process.env.NEXT_PUBLIC_BUILD_ID || 'dev'
  const buildTimestamp = new Date().toISOString()
  const buildSha =
    process.env.NEXT_PUBLIC_GIT_SHA ||
    process.env.GIT_SHA ||
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    ''

  if (isStandalonePage) {
    return <>{children}</>
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/60 bg-white/70 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight shrink-0">
            <img
              src="/brand/classmate-owl.png"
              alt="Classmate"
              style={{ height: '32px', width: 'auto' }}
            />
            {/* Hidden on mobile to prevent overlap with nav */}
            <span className="text-[#7BB7FF] hidden md:inline">ClassMate</span>
          </Link>
          <Nav />
        </div>
      </header>
      {children}
      <FeedbackButton />
      <footer className="mx-auto w-full max-w-6xl px-4 py-6 text-xs text-slate-400">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>&copy; {new Date().getFullYear()} ClassMate</span>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-slate-600 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-slate-600 transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
        {process.env.NODE_ENV !== 'production' && (
          <div className="mt-2">
            Build: {buildTimestamp} | id: {buildId}
            {buildSha ? ` | sha: ${buildSha}` : ''}
            <AuthDebug />
          </div>
        )}
      </footer>
    </>
  )
}
