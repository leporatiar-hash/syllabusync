'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut, Settings } from 'lucide-react'
import { useAuth } from '../lib/useAuth'
import { API_URL, useAuthFetch } from '../hooks/useAuthFetch'

const baseNavItems = [
  { href: '/courses', label: 'Courses' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/chat', label: 'Chat' },
]

export default function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading, signOut } = useAuth()
  const { fetchWithAuth } = useAuthFetch()
  const [profilePicture, setProfilePicture] = useState<string | null>(null)
  const homeHref = !loading && user ? '/home' : '/'
  const navItems = [{ href: homeHref, label: 'Home' }, ...baseNavItems]

  const initials = (user?.email?.[0] || 'U').toUpperCase()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close the mobile avatar menu on outside tap or Escape
  useEffect(() => {
    if (!menuOpen) return
    const onPointer = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const avatar = profilePicture ? (
    <img src={profilePicture} alt="" className="h-full w-full object-cover" />
  ) : (
    initials
  )

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
      {/* Desktop: inline links + avatar + log out. Mobile uses MobileTabBar for the links. */}
      <nav className="hidden md:flex items-center gap-2 sm:gap-6 text-[11px] sm:text-sm text-slate-600">
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
              {avatar}
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

      {/* Mobile: just the avatar (menu holds Settings + Log out), or Log In when signed out */}
      <div className="md:hidden">
        {loading ? null : !user ? (
          <button
            onClick={() => router.push('/login')}
            className="rounded-lg bg-[#5B8DEF] px-4 py-2 text-sm text-white font-semibold shadow hover:bg-[#3b6ed6] transition-colors"
          >
            Log In
          </button>
        ) : (
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Account menu"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#5B8DEF] to-[#A78BFA] text-sm font-bold text-white overflow-hidden"
            >
              {avatar}
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-2xl border border-slate-100 bg-white py-1 shadow-lg"
              >
                <p className="truncate px-4 py-2.5 text-xs text-slate-500">{user.email}</p>
                <div className="h-px bg-slate-100" />
                <Link
                  href="/settings"
                  prefetch={false}
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 active:bg-slate-50"
                >
                  <Settings size={16} className="text-slate-400" /> Settings
                </Link>
                <button
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    signOut()
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 active:bg-slate-50"
                >
                  <LogOut size={16} className="text-slate-400" /> Log out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
