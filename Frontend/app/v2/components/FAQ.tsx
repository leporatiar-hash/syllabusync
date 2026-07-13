const faqs = [
  {
    q: 'What happens after the free trial?',
    a: "After your 10-day Pro trial, you're moved to the free plan automatically. No charge, no surprise billing — you can upgrade to Pro whenever you're ready.",
  },
  {
    q: 'How does the free tier work?',
    a: 'The free plan includes 3 courses, syllabus deadline extraction, a full calendar view, 50 AI generations a month, and AI chat with 10 messages per week. Pro removes those limits.',
  },
  {
    q: 'Does it work with Canvas or OAKS?',
    a: 'Yes — connect Canvas (or OAKS) directly for automatic assignment and due-date sync. ClassMate also supports iCal, Google Calendar, and Outlook Calendar feeds, or you can just upload a syllabus PDF.',
  },
  {
    q: 'What file types can I upload?',
    a: 'Syllabi can be uploaded as PDF or Word (.docx). For other study materials — notes, slides, readings — you can also upload text files and images (PNG/JPG).',
  },
  {
    q: 'Is my data private?',
    a: "Yes. We don't sell your data and we don't train AI models on your notes. Files are encrypted at rest and in transit, and you can delete your account and data at any time.",
  },
  {
    q: 'Do I need to download anything?',
    a: 'No — ClassMate runs entirely in your browser. No app install required.',
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
