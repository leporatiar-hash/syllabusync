'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '../lib/useAuth'

const navItems = [
  { href: '/', label: 'Home' },
  { href: '/courses', label: 'Courses' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/flashcards', label: 'Flashcards' },
]

export default function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading, signOut } = useAuth()

  const fullName = user?.user_metadata?.full_name as string | undefined
  const profilePicture = user?.user_metadata?.profile_picture as string | undefined
  const initials = (fullName?.[0] || user?.email?.[0] || 'U').toUpperCase()

  return (
    <>
      <nav className="flex items-center gap-6 text-sm text-slate-600">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative pb-1 transition-all duration-300 hover:text-slate-900 ${
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
