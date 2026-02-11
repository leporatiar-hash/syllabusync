'use client'

import { useState } from 'react'
import { API_URL, useAuthFetch } from '../hooks/useAuthFetch'

interface Props {
  onClose: () => void
  onSuccess: () => void
}

export default function CanvasConnectModal({ onClose, onSuccess }: Props) {
  const { fetchWithAuth } = useAuthFetch()
  const [instanceUrl, setInstanceUrl] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const url = instanceUrl.trim().replace(/\/+$/, '')
    if (!url.startsWith('https://')) {
      setError('Instance URL must start with https://')
      return
    }
    if (!accessToken.trim()) {
      setError('Access token is required')
      return
    }

    setLoading(true)
    try {
      const res = await fetchWithAuth(`${API_URL}/lms/connect/canvas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instance_url: url, access_token: accessToken.trim() }),
      })

      if (res.ok) {
        onSuccess()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.detail || 'Failed to connect to Canvas')
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
        className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-lg font-semibold text-slate-900">Connect Canvas LMS</h2>
        <p className="mb-5 text-sm text-slate-500">
          Enter your Canvas instance URL and a personal access token to sync your assignments.
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="canvas-url" className="mb-1 block text-sm font-medium text-slate-700">
              Canvas Instance URL
            </label>
            <input
              id="canvas-url"
              type="url"
              value={instanceUrl}
              onChange={(e) => setInstanceUrl(e.target.value)}
              placeholder="https://yourschool.instructure.com"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition-colors focus:border-[#5B8DEF] focus:ring-2 focus:ring-[#5B8DEF]/20"
              required
            />
          </div>

          <div>
            <label htmlFor="canvas-token" className="mb-1 block text-sm font-medium text-slate-700">
              Access Token
            </label>
            <input
              id="canvas-token"
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="Your Canvas personal access token"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition-colors focus:border-[#5B8DEF] focus:ring-2 focus:ring-[#5B8DEF]/20"
              required
            />
            <p className="mt-1.5 text-xs text-slate-400">
              Go to Canvas &rarr; Account &rarr; Settings &rarr; New Access Token
            </p>
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
