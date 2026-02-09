'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '../lib/useAuth'
import { API_URL, useAuthFetch } from '../hooks/useAuthFetch'

const navItems = [
  { href: '/', label: 'Home' },
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
    </>
  )
}
