'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, CalendarDays, Home, MessageCircle, type LucideIcon } from 'lucide-react'
import { useAuth } from '../lib/useAuth'

const tabs: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/courses', label: 'Courses', icon: BookOpen },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/chat', label: 'Chat', icon: MessageCircle },
]

/**
 * Phone-only bottom tab bar (the desktop header nav is hidden below md). Height is --tabbar-h in
 * globals.css; the spacer keeps the footer from ending up underneath the fixed bar.
 * z-40 so modals and bottom sheets (z-50) still cover it.
 */
export default function MobileTabBar() {
  const pathname = usePathname()
  const { user, loading } = useAuth()
  if (loading || !user) return null

  return (
    <>
      <div aria-hidden className="h-[var(--tabbar-h)] md:hidden" />
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 backdrop-blur md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* 3.5rem total including the 1px top border, matching --tabbar-h */}
        <ul className="grid h-[calc(3.5rem-1px)] grid-cols-4">
          {tabs.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`)
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex h-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                    active ? 'text-[#5B8DEF]' : 'text-slate-500'
                  }`}
                >
                  <Icon size={22} strokeWidth={active ? 2.25 : 1.75} />
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}
