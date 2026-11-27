import Link from 'next/link'

export const metadata = {
  title: 'Support · ClassMate',
  description: 'Help with ClassMate: connecting your LMS, reminders, subscriptions and your account.',
}

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: 'How do I connect my school’s LMS?',
    a: 'In the app, pick your school and sign in to your school’s Canvas, Brightspace (D2L) or Blackboard site. ClassMate saves your read-only calendar link and pulls in your due dates. It never sees or stores your password. Your due dates then refresh on their own every few hours.',
  },
  {
    q: 'My due dates stopped updating.',
    a: 'Open the app. If your connection needs attention you’ll see a “stopped syncing” notice; tap it and sign in to your LMS again. If that doesn’t fix it, email us and tell us your school.',
  },
  {
    q: 'My school isn’t found, or the wrong login page opens.',
    a: 'Choose “That’s not it” and enter your LMS address (for example yourschool.instructure.com), or email us your school’s name and we’ll add it.',
  },
  {
    q: 'I’m not getting reminders.',
    a: 'On iPhone, go to Settings › Notifications › ClassMate and turn on Allow Notifications. In the app, check Settings › Reminders.',
  },
  {
    q: 'How do I cancel or manage my subscription?',
    a: 'If you subscribed in the iPhone app: iPhone Settings › your name › Subscriptions › ClassMate. Apple handles refunds for App Store purchases at reportaproblem.apple.com. If you subscribed on the website, manage it from Settings on tryclassmate.com.',
  },
  {
    q: 'How do I delete my account?',
    a: 'In the app: Settings › Delete account. On the web: Settings › Delete account. This permanently removes your courses, deadlines, notes and LMS connections.',
  },
]

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#F5F7FA] to-[#E8EDFB]">
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-[#5B8DEF] transition-colors mb-8">
          ← Back to home
        </Link>

        <div className="rounded-3xl bg-white p-8 md:p-12 shadow-sm">
          <h1 className="text-3xl font-semibold text-slate-900">Support</h1>
          <p className="mt-3 text-slate-600 leading-relaxed">
            Questions, a bug, or a wrong due date? Email{' '}
            <a href="mailto:hello@tryclassmate.com" className="text-[#5B8DEF] hover:underline">hello@tryclassmate.com</a>{' '}
            and a real person will get back to you, usually within a day.
          </p>

          <div className="mt-10 space-y-8">
            {FAQ.map(({ q, a }) => (
              <section key={q}>
                <h2 className="text-lg font-semibold text-slate-900">{q}</h2>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{a}</p>
              </section>
            ))}
          </div>

          <div className="mt-12 border-t border-slate-100 pt-6 text-sm text-slate-500 flex gap-4">
            <Link href="/privacy" className="hover:text-[#5B8DEF]">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-[#5B8DEF]">Terms of Use</Link>
          </div>
        </div>
      </div>
    </main>
  )
}
