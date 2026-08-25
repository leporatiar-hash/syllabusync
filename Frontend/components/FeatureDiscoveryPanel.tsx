'use client'

import Link from 'next/link'
import posthog from 'posthog-js'

interface Card {
  key: 'study_guide' | 'flashcards' | 'chat'
  title: string
  description: string
  href: string
  showLimitNote: boolean
}

interface Props {
  latestCourseId: string
  onHide: () => void
}

export default function FeatureDiscoveryPanel({ latestCourseId, onHide }: Props) {
  const cards: Card[] = [
    {
      key: 'study_guide',
      title: 'Study guide',
      description: 'Turn any syllabus or unit into a study guide in one click.',
      href: `/study-studio?course=${latestCourseId}`,
      showLimitNote: true,
    },
    {
      key: 'flashcards',
      title: 'Flashcards',
      description: 'Generate a flashcard set from your course materials.',
      href: `/flashcards?course=${latestCourseId}`,
      showLimitNote: true,
    },
    {
      key: 'chat',
      title: 'Chat',
      description: 'Ask questions about your classes. It knows your syllabus and due dates.',
      href: `/chat?prompt=${encodeURIComponent("What's due this week and what should I start first?")}`,
      showLimitNote: false,
    },
  ]

  return (
    <section className="mx-auto max-w-6xl px-4 pb-10">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Get more out of your courses</h2>
        <button
          onClick={onHide}
          className="text-xs font-medium text-slate-400 transition-colors hover:text-slate-600 hover:underline"
        >
          Hide
        </button>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <div key={card.key} className="flex flex-col rounded-2xl border border-white bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">{card.title}</h3>
            <p className="mt-1.5 flex-1 text-sm text-slate-600">{card.description}</p>
            {card.showLimitNote && (
              <p className="mt-3 text-xs text-slate-400">Free tier: 50 generations/month</p>
            )}
            <Link
              href={card.href}
              onClick={() => posthog.capture('feature_discovery_card_clicked', { card: card.key })}
              className="mt-4 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
            >
              Try it
            </Link>
          </div>
        ))}
      </div>
    </section>
  )
}
