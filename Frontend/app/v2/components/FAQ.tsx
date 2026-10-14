import { PRICING } from '../../../lib/pricing'

const faqs = [
  {
    q: 'Does it work with my school?',
    a: "Most likely. ClassMate works with any school on Canvas or Brightspace (D2L), including OAKS at the College of Charleston. Pick your school and we'll find your LMS. You can also add syllabi as PDF or Word files.",
  },
  {
    q: 'What happens when a professor changes a due date?',
    a: "Your LMS is the source of truth, so ClassMate checks it every few hours and updates your calendar on its own. With Pro, you also get a notification that night saying what moved and when it's due now.",
  },
  {
    q: "What's free and what's Pro?",
    a: 'Free: all your classes and due dates from your LMS, syllabus reading, the calendar, a reminder the night before each deadline, and 50 study-tool generations a month. Pro adds change alerts, heads-ups 3 days ahead and a week before exams, a Sunday game plan, and unlimited study tools.',
  },
  {
    q: 'How much is Pro, and can I cancel?',
    a: `${PRICING.monthly.label}${PRICING.monthly.per}, or ${PRICING.semester.label} for a ${PRICING.semester.name} that renews ${PRICING.semester.per}. Cancel anytime in Settings and keep Pro until the end of what you paid for. Not happy? Email us within 14 days for a full refund, no questions asked.`,
  },
  {
    q: 'Can my parents pay for it, or use a 529 plan?',
    a: "Yes. Receipts list ClassMate as educational software used by the student, which many 529 plans accept. Check with your plan or a tax professional; this isn't tax advice.",
  },
  {
    q: 'Is my data private?',
    a: "Yes. We never see your school password, your calendar link is stored encrypted, we don't sell your data or show ads, and you can delete your account and everything in it anytime.",
  },
  {
    q: 'Is there an app?',
    a: 'ClassMate works in any browser today. The iPhone app, with one-tap LMS sign-in and push reminders, is coming soon.',
  },
]

export default function FAQ() {
  return (
    <section id="faq" className="py-24 px-6 bg-white">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900">Frequently asked questions</h2>
        </div>

        <div className="space-y-3">
          {faqs.map((item) => (
            <details
              key={item.q}
              className="group rounded-2xl border border-slate-200 bg-white open:border-[#5B4EE8]/40 open:shadow-sm"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 text-sm font-semibold text-slate-900 marker:content-none [&::-webkit-details-marker]:hidden">
                {item.q}
                <svg
                  className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-45"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </summary>
              <p className="px-6 pb-5 text-sm text-slate-600 leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
