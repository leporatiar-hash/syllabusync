import type { Metadata } from 'next'
import V2LandingPage from './V2LandingPage'

export const metadata: Metadata = {
  title: 'ClassMate — The AI that knows your entire semester',
  description: 'Upload your syllabus once. Ask anything — deadlines, policies, what\'s due this week.',
  robots: { index: false, follow: false },
}

export default function V2Page() {
  return <V2LandingPage />
}
