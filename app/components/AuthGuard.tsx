'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '../context/AuthContext'

const PUBLIC_PATHS = ['/', '/login', '/signup', '/favicon.ico']

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.includes(pathname)) return true
  if (pathname.startsWith('/_next')) return true
  return false
}

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isLoading && !token && !isPublicPath(pathname)) {
      window.dispatchEvent(new Event('auth:open'))
    }
  }, [token, isLoading, pathname, router])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    )
  }

  if (!token && !isPublicPath(pathname)) return null

  return <>{children}</>
}
