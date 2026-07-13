import type { Metadata } from 'next'
import HomeGate from './HomeGate'

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
