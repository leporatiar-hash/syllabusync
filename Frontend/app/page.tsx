import type { Metadata } from 'next'
import HomeGate from './HomeGate'

// This route's content depends entirely on client-side auth state (logged
// out -> marketing page, logged in -> redirect to /home), so it must never
// be statically prerendered — a static build bakes in a broken, half-hydrated
// snapshot that visitors can get stuck on indefinitely.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'ClassMate — The AI that knows your entire semester',
  description: "Upload your syllabus once. Ask anything — deadlines, policies, what's due this week.",
  openGraph: {
    title: 'ClassMate — The AI that knows your entire semester',
    description: "Upload your syllabus once. Ask anything — deadlines, policies, what's due this week.",
    siteName: 'ClassMate',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ClassMate — The AI that knows your entire semester',
    description: "Upload your syllabus once. Ask anything — deadlines, policies, what's due this week.",
  },
}

export default function HomePage() {
  return <HomeGate />
}
