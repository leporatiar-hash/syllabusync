'use client'

import { useAuth } from '../lib/useAuth'

export default function AuthDebug() {
  const { user, loading } = useAuth()
  if (loading) return null
  return (
    <span className="ml-2 text-[10px] uppercase tracking-wide text-slate-400">
      Auth: native JWT | user: {user ? 'true' : 'false'}
    </span>
  )
}
