'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { href: '/', label: 'Home' },
  { href: '/courses', label: 'Courses' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/flashcards', label: 'Flashcards' },
]

export default function Nav() {
  const pathname = usePathname()
  const { token, profile } = useAuth()

  if (!token) return null

  const initials = (
    profile?.full_name?.[0] ||
    profile?.email?.[0] ||
    'U'
  ).toUpperCase()

  return (
    <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex">
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

      <Link
        href="/settings"
        className="ml-2 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#5B8DEF] to-[#A78BFA] text-xs font-bold text-white overflow-hidden transition-transform hover:scale-105"
      >
        {profile?.profile_picture ? (
          <img src={profile.profile_picture} alt="" className="h-full w-full object-cover" />
        ) : (
          initials
        )}
      </Link>
    </nav>
  )
}
