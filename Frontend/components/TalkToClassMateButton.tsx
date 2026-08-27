'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '../lib/useAuth'

export default function TalkToClassMateButton() {
  const { user, loading } = useAuth()
  const pathname = usePathname()

  // Only show for logged-in users, and not on the chat page itself
  if (loading || !user) return null
  if (pathname === '/chat' || pathname?.startsWith('/chat/')) return null

  return (
    <Link
      href="/chat"
      className="hidden md:flex fixed bottom-6 right-6 z-50 items-center gap-2 rounded-full bg-gradient-to-r from-[#5B4EE8] to-[#7C6FF2] px-5 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-105"
      aria-label="Talk to ClassMate"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
      Talk to ClassMate
    </Link>
  )
}
