'use client'

import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

interface AuthModalProps {
  open: boolean
  onClose: () => void
}

export default function AuthModal({ open, onClose }: AuthModalProps) {
  const { requestCode, verifyCode } = useAuth()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (step === 'email') {
        await requestCode(email)
        setStep('code')
      } else {
        await verifyCode(email, code)
        onClose()
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl border border-white/30 bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Log in</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
              {error}
            </div>
          )}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={step === 'code'}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition-colors focus:border-[#5B8DEF] focus:ring-2 focus:ring-[#5B8DEF]/20"
            placeholder="you@school.edu"
          />
          {step === 'code' && (
            <input
              type="text"
              inputMode="numeric"
              pattern="\\d{6}"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition-colors focus:border-[#5B8DEF] focus:ring-2 focus:ring-[#5B8DEF]/20"
              placeholder="123456"
            />
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gradient-to-r from-[#5B8DEF] to-[#A78BFA] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Starting...' : step === 'email' ? 'Send Code' : 'Verify & Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
