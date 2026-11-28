import type { Metadata } from 'next'
import HomeGate from './HomeGate'

export const metadata: Metadata = {
  title: 'classmate: never get caught off guard by a due date',
  description: "Every deadline from your LMS and syllabi in one calendar, with a heads-up when a professor moves one. Free for students.",
  openGraph: {
    title: 'classmate: never get caught off guard by a due date',
    description: "Every deadline from your LMS and syllabi in one calendar, with a heads-up when a professor moves one. Free for students.",
    siteName: 'classmate',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'classmate: never get caught off guard by a due date',
    description: "Every deadline from your LMS and syllabi in one calendar, with a heads-up when a professor moves one. Free for students.",
  },
}

export default function HomePage() {
  return <HomeGate />
}
