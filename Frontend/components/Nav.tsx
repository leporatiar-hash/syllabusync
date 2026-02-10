'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '../lib/useAuth'
import { API_URL, useAuthFetch } from '../hooks/useAuthFetch'
import dynamic from 'next/dynamic'

const FeedbackModal = dynamic(() => import('./FeedbackModal'), { ssr: false })

const baseNavItems = [
  { href: '/courses', label: 'Courses' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/study-studio', label: 'Study Studio' },
]

export default function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading, signOut } = useAuth()
  const { fetchWithAuth } = useAuthFetch()
  const [profilePicture, setProfilePicture] = useState<string | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const homeHref = !loading && user ? '/home' : '/'
  const navItems = [{ href: homeHref, label: 'Home' }, ...baseNavItems]

  const fullName = user?.user_metadata?.full_name as string | undefined
  const initials = (fullName?.[0] || user?.email?.[0] || 'U').toUpperCase()

  // Fetch avatar from backend once — keeps it out of the JWT entirely
  useEffect(() => {
    if (!user) {
      setProfilePicture(null)
      return
    }
    const loadAvatar = async () => {
      try {
        const res = await fetchWithAuth(`${API_URL}/me`)
        if (res.ok) {
          const data = await res.json()
          setProfilePicture(data.profile?.profile_picture || null)
        }
      } catch {
        // non-fatal
      }
    }
    loadAvatar()
  }, [user])

  useEffect(() => {
    const logoAnchor = document
      .querySelector('header a img[alt="Classmate"]')
      ?.closest('a') as HTMLAnchorElement | null
    if (!logoAnchor) return

    const handleLogoClick = (event: MouseEvent) => {
      if (loading || !user) return
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0
      ) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      router.push('/home')
    }

    logoAnchor.addEventListener('click', handleLogoClick, true)
    return () => {
      logoAnchor.removeEventListener('click', handleLogoClick, true)
    }
  }, [user, loading, router])

  return (
    <>
      <nav className="flex items-center gap-2 sm:gap-6 text-[11px] sm:text-sm text-slate-600">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative pb-1 transition-all duration-300 hover:text-slate-900 whitespace-nowrap ${
                isActive ? 'text-slate-900' : ''
              }`}
            >
              <span>{item.label}</span>
              <span
                className={`absolute left-0 -bottom-1 h-[3px] w-full rounded-full bg-[#5B8DEF] transition-all duration-300 ${
                  isActive ? 'opacity-100' : 'opacity-0'
                }`}
              />
            </Link>
          )
        })}

        {loading ? null : !user ? (
          <button
            onClick={() => router.push('/login')}
            className="rounded-lg bg-[#5B8DEF] px-4 py-2 text-white font-semibold shadow hover:bg-[#3b6ed6] transition-colors"
          >
            Log In
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <Link
              href="/settings"
              prefetch={false}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#5B8DEF] to-[#A78BFA] text-xs font-bold text-white overflow-hidden transition-transform hover:scale-105"
            >
              {profilePicture ? (
                <img src={profilePicture} alt="" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </Link>
            <button
              onClick={() => signOut()}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Log out
            </button>
          </div>
        )}
      </nav>

      {/* Floating Feedback Button - Bottom Right */}
      {!loading && user && (
        <button
          onClick={() => setShowFeedback(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-5 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-105"
          aria-label="Send Feedback"
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
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Feedback
        </button>
      )}

      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
    </>
  )
}
