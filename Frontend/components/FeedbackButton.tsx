'use client'

import { useState } from 'react'
import { useAuth } from '../lib/useAuth'
import dynamic from 'next/dynamic'

const FeedbackModal = dynamic(() => import('../components/FeedbackModal'), { ssr: false })

export default function FeedbackButton() {
  const { user, loading } = useAuth()
  const [showFeedback, setShowFeedback] = useState(false)

  // Only show for logged-in users
  if (loading || !user) return null

  return (
    <>
      {/* Floating Feedback Button - Bottom Right */}
      <button
        onClick={() => setShowFeedback(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-5 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-105"
        aria-label="Send Feedback"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        Feedback
      </button>

      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
    </>
  )
}
