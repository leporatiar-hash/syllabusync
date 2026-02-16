'use client'

import { useState, useRef } from 'react'
import posthog from 'posthog-js'
import { API_URL, useAuthFetch } from '../hooks/useAuthFetch'

interface Props {
  onClose: () => void
  onSuccess: () => void
}

export default function ICalConnectModal({ onClose, onSuccess }: Props) {
  const { fetchWithAuth } = useAuthFetch()
  const [icalUrl, setIcalUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showGuide, setShowGuide] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const url = icalUrl.trim()
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      setError('URL must start with http:// or https://')
      return
    }

    setLoading(true)
    try {
      const res = await fetchWithAuth(`${API_URL}/lms/connect/ical`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ical_url: url }),
      })

      if (res.ok) {
        posthog.capture('lms_connected', { provider: 'ical' })
        onSuccess()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.detail || 'Failed to connect iCal feed')
      }
    } catch {
      setError('Connection failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`mx-4 w-full rounded-2xl bg-white p-6 shadow-xl transition-all duration-300 ${showGuide ? 'max-w-lg' : 'max-w-md'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-lg font-semibold text-slate-900">Connect iCal Feed</h2>
        <p className="mb-5 text-sm text-slate-500">
          Paste an iCal (.ics) feed URL to sync events and deadlines into your calendar.
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="ical-url" className="mb-1 block text-sm font-medium text-slate-700">
              iCal Feed URL
            </label>
            <input
              id="ical-url"
              type="url"
              value={icalUrl}
              onChange={(e) => setIcalUrl(e.target.value)}
              placeholder="https://calendar.google.com/calendar/ical/..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition-colors focus:border-[#5B8DEF] focus:ring-2 focus:ring-[#5B8DEF]/20"
              required
            />
            <button
              type="button"
              onClick={() => {
                setShowGuide(!showGuide)
                if (!showGuide && videoRef.current) {
                  videoRef.current.pause()
                }
              }}
              className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-[#5B8DEF] transition-colors hover:text-[#4C7FE6]"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              {showGuide ? 'Hide guide' : 'Need help finding your URL?'}
            </button>
            {showGuide && (
              <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                <video
                  ref={videoRef}
                  src="/ical-guide.mp4"
                  controls
                  playsInline
                  className="w-full"
                />
                <p className="px-3 py-2 text-[11px] text-slate-500">
                  How to find your iCal feed URL in OAKS / Canvas
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-gradient-to-r from-[#5B8DEF] to-[#A78BFA] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Connecting...' : 'Connect'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
