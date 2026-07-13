'use client'

import { Component, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../lib/useAuth'
import V2LandingPage from './v2/V2LandingPage'

// TEMPORARY diagnostic — catches render errors that might otherwise be
// silently swallowed, and renders the message directly into the page so
// it's visible even if console output is suppressed.
class DiagBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? `${error.message}\n${error.stack}` : String(error) }
  }
  render() {
    if (this.state.error) {
      return (
        <pre
          id="diag-error"
          style={{ whiteSpace: 'pre-wrap', padding: 16, fontSize: 12, color: 'red', background: 'white' }}
        >
          RENDER ERROR: {this.state.error}
        </pre>
      )
    }
    return this.props.children
  }
}

function DiagWindowErrors() {
  const [msgs, setMsgs] = useState<string[]>([])

  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      setMsgs((m) => [...m, `window.onerror: ${e.message} @ ${e.filename}:${e.lineno} ${e.error?.stack || ''}`])
    }
    const onRejection = (e: PromiseRejectionEvent) => {
      setMsgs((m) => [...m, `unhandledrejection: ${String(e.reason?.message || e.reason)} ${e.reason?.stack || ''}`])
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  if (msgs.length === 0) return null
  return (
    <pre
      id="diag-window-errors"
      style={{ whiteSpace: 'pre-wrap', padding: 16, fontSize: 12, color: 'orange', background: 'white' }}
    >
      {msgs.join('\n---\n')}
    </pre>
  )
}

export default function HomeGate() {
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    // If user is logged in, redirect to home dashboard
    if (!loading && user) {
      router.replace('/home')
    }
  }, [user, loading, router])

  return (
    <DiagBoundary>
      <DiagWindowErrors />
      <HomeGateInner user={user} loading={loading} />
    </DiagBoundary>
  )
}

function HomeGateInner({ user, loading }: { user: unknown; loading: boolean }) {
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
    return <V2LandingPage />
  }

  // While redirecting, show nothing
  return null
}
