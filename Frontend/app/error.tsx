'use client'

import { useEffect, useState } from 'react'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [details, setDetails] = useState('')

  useEffect(() => {
    console.error('[ErrorBoundary] Unhandled error:', error)
    if (process.env.NODE_ENV !== 'production') {
      setDetails(error.message || '')
    }
  }, [error])

  return (
    <main className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
          <svg className="h-7 w-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376a12 12 0 1 0 20.817 0M12 15.75h.008v.008H12v-.008z" />
          </svg>
        </div>

        <h1 className="mt-4 text-xl font-semibold text-slate-900">Something went wrong</h1>
        <p className="mt-2 text-sm text-slate-500">
          An unexpected error occurred. Your data is safe — just try refreshing the page.
        </p>

        {details && (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 text-left">
            {details}
          </p>
        )}

        <button
          onClick={reset}
          className="mt-6 w-full rounded-lg bg-gradient-to-r from-[#5B8DEF] to-[#A78BFA] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
        >
          Try again
        </button>
      </div>
    </main>
  )
}
