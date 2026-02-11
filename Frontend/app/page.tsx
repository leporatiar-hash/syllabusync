'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../lib/useAuth'
import LandingPage from './landing/page'

export default function HomePage() {
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    // If user is logged in, redirect to home dashboard
    if (!loading && user) {
      router.replace('/home')
    }
  }, [user, loading, router])

  // Show loading state while checking auth
  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#5B8DEF] border-t-transparent" />
      </main>
    )
  }

  // Show landing page for non-authenticated users
  if (!user) {
    return <LandingPage />
  }

  // While redirecting, show nothing
  return null
}
