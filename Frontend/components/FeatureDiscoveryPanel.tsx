'use client'

import Link from 'next/link'
import posthog from 'posthog-js'
import { ChevronRight, Layers, MessageCircle, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'

interface Card {
  key: 'study_guide' | 'flashcards' | 'chat'
  title: string
  description: string
  href: string
  icon: ReactNode
}

interface Props {
  latestCourseId: string
  onHide: () => void
}

// Compact sidebar list on the home dashboard nudging students toward the AI tools they haven't tried.
export default function FeatureDiscoveryPanel({ latestCourseId, onHide }: Props) {
  const cards: Card[] = [
    {
      key: 'study_guide',
      title: 'Study guide',
      description: 'Turn a syllabus or unit into a guide',
      href: `/study-studio?course=${latestCourseId}`,
      icon: <Sparkles size={16} />,
    },
    {
      key: 'flashcards',
      title: 'Flashcards',
      description: 'Generate a set from your materials',
      href: `/flashcards?course=${latestCourseId}`,
      icon: <Layers size={16} />,
    },
    {
      key: 'chat',
      title: 'Chat',
      description: 'Ask what’s due and what to start first',
      href: `/chat?prompt=${encodeURIComponent("What's due this week and what should I start first?")}`,
      icon: <MessageCircle size={16} />,
    },
  ]

  return (
    <div className="rounded-2xl border border-white bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Try these</h2>
        <button
          onClick={onHide}
          className="text-xs font-medium text-slate-400 transition-colors hover:text-slate-600 hover:underline"
        >
          Hide
        </button>
      </div>
      <ul className="mt-3 -mx-2">
        {cards.map((card) => (
          <li key={card.key}>
            <Link
              href={card.href}
              onClick={() => posthog.capture('feature_discovery_card_clicked', { card: card.key })}
              className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-slate-50"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#EEF2FF] to-[#F0FDFF] text-[#5B8DEF]">
                {card.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-800">{card.title}</span>
                <span className="block truncate text-xs text-slate-500">{card.description}</span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-slate-300 transition-colors group-hover:text-slate-500" />
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-slate-400">Free plan: 50 AI generations/month</p>
    </div>
  )
}
