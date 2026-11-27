import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy · ClassMate',
  description: 'What ClassMate collects, why, who processes it, and how to delete it.',
}

const CONTACT = 'hello@tryclassmate.com'

function Mail() {
  return (
    <a href={`mailto:${CONTACT}`} className="text-[#5B8DEF] hover:underline">
      {CONTACT}
    </a>
  )
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section id={`s${n}`}>
      <h2 className="text-lg font-semibold text-slate-900 mb-3">
        {n}. {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

const PROVIDERS: [string, string][] = [
  ['Railway and Vercel', 'Hosting for our servers, database and website'],
  ['Supabase', 'Sign-in for some older accounts'],
  ['OpenAI', 'Reading syllabi, study tools (flashcards, quizzes, summaries) and chat'],
  ['Stripe', 'Payments on the website'],
  ['Apple and RevenueCat', 'Payments in the iPhone app'],
  ['Resend', 'Account and receipt emails, and our support inbox'],
  ['Expo and Apple', 'Delivering push notifications to your phone'],
  ['PostHog and Vercel Analytics', 'Product analytics: which features are used'],
  ['Sentry', 'Error and crash reports'],
]

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#F5F7FA] to-[#E8EDFB]">
      <div className="mx-auto max-w-4xl px-4 py-16">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-[#5B8DEF] transition-colors mb-8">
          ← Back to home
        </Link>

        <div className="rounded-3xl bg-white p-8 md:p-12 shadow-sm">
          <h1 className="text-3xl font-semibold text-slate-900">Privacy Policy</h1>
          <p className="mt-2 text-sm text-slate-500">Last updated November 27, 2026</p>

          <div className="mt-8 space-y-10 text-sm text-slate-600 leading-relaxed">
            <section>
              <p>
                This policy explains what ClassMate collects, why, who helps us process it, and how you can see or delete it. It
                covers the ClassMate iPhone app and the website at{' '}
                <a href="https://www.tryclassmate.com" className="text-[#5B8DEF] hover:underline">tryclassmate.com</a> (together,
                &quot;ClassMate&quot;). ClassMate is run by Alexander Leporati (&quot;we,&quot; &quot;us&quot;). Questions:{' '}
                <Mail />.
              </p>
              <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                <p className="font-medium text-slate-800">The short version</p>
                <ul className="mt-2 list-disc list-inside space-y-1">
                  <li>We collect what we need to show your deadlines and remind you about them.</li>
                  <li>We don&apos;t sell your information, show ads, or let anyone track you for advertising.</li>
                  <li>We never see your school password or your grades.</li>
                  <li>You can delete your account and data anytime in Settings.</li>
                </ul>
              </div>
            </section>

            <Section n={1} title="What we collect">
              <p>
                <strong className="text-slate-800">Your account.</strong> Email address, password (stored only as a secure hash),
                name, and, if you add them, your school, year in school, major, profile picture, and how you heard about us.
              </p>
              <p>
                <strong className="text-slate-800">What you add.</strong> Courses, deadlines, to-dos, notes, syllabi and other files
                you upload, flashcards, quizzes and summaries you create, and your chat messages with ClassMate.
              </p>
              <p>
                <strong className="text-slate-800">Your school&apos;s LMS, if you connect it.</strong> When you connect Canvas,
                Brightspace (D2L) or Blackboard, you sign in on your school&apos;s own page. ClassMate does not see or store your
                password. We save a read-only calendar link from your LMS (encrypted) and the course names and due dates in that
                calendar. If you connected Canvas with an access token, we store that token encrypted. We don&apos;t receive your
                grades.
              </p>
              <p>
                <strong className="text-slate-800">From the iPhone app.</strong> A push-notification token so we can send
                reminders, and your device&apos;s time zone so reminders and due dates are shown at the right local time. We
                don&apos;t collect your location, contacts or photos (except files you choose to upload).
              </p>
              <p>
                <strong className="text-slate-800">Purchases.</strong> Your plan and subscription status. Card details are handled
                by Stripe (website) or Apple (iPhone app); we never see your full card number.
              </p>
              <p>
                <strong className="text-slate-800">Usage and diagnostics.</strong> Which features are used and how (for example,
                that a syllabus was uploaded or a step in connecting your LMS was reached), basic device and browser information,
                and error reports when something breaks.
              </p>
              <p>
                <strong className="text-slate-800">When you contact us.</strong> Anything you send in support emails or feedback
                surveys.
              </p>
            </Section>

            <Section n={2} title="How we use it">
              <ul className="list-disc list-inside space-y-1.5">
                <li>To run ClassMate: show your courses and deadlines, keep them in sync with your LMS, and send the reminders you turn on.</li>
                <li>To power the AI features you use: reading a syllabus, making study tools, and answering questions about your classes.</li>
                <li>To manage your subscription and send account emails such as password resets and receipts.</li>
                <li>To fix bugs, keep ClassMate secure, and understand which features help so we can improve them.</li>
                <li>To answer you when you contact us.</li>
              </ul>
              <p>We don&apos;t use your information for advertising, and we don&apos;t sell it or share it for cross-context behavioral advertising.</p>
            </Section>

            <Section n={3} title="Who processes it for us">
              <p>
                We use these service providers to run ClassMate. They process information only to provide their service to us.
              </p>
              <div className="overflow-hidden rounded-2xl border border-slate-100">
                <table className="w-full text-left">
                  <tbody>
                    {PROVIDERS.map(([who, why]) => (
                      <tr key={who} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-2.5 font-medium text-slate-800 align-top w-2/5">{who}</td>
                        <td className="px-4 py-2.5">{why}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                <strong className="text-slate-800">AI processing.</strong> When you use an AI feature, the relevant text (for example
                your syllabus, notes, deadlines or chat message) is sent to OpenAI to generate the result. Under OpenAI&apos;s API
                terms, this data isn&apos;t used to train their models.
              </p>
              <p>
                We may also disclose information if required by law, to protect someone&apos;s safety, or as part of a sale or
                merger of ClassMate (in which case this policy would continue to apply).
              </p>
            </Section>

            <Section n={4} title="Cookies and tracking">
              <p>
                The website uses cookies and browser storage to keep you signed in and remember your settings, plus privacy-focused
                product analytics (PostHog and Vercel Analytics). We don&apos;t use advertising cookies, don&apos;t show ads, and
                don&apos;t allow third parties to track you on ClassMate for advertising. The iPhone app doesn&apos;t track you
                across other companies&apos; apps or websites.
              </p>
            </Section>

            <Section n={5} title="How long we keep it">
              <p>
                We keep your information while your account is open. When you delete your account, we delete your account,
                courses, deadlines, notes, study sets, chats, LMS connections and push tokens from our live systems. Copies in
                backups and our providers&apos; logs are removed as those roll over. We may keep limited records, such as payment
                records, where the law requires it.
              </p>
            </Section>

            <Section n={6} title="How we protect it">
              <p>
                Data is sent over encrypted connections (HTTPS). LMS calendar links and access tokens are encrypted at rest, and
                passwords are stored as secure hashes. Access to our systems is limited. No system is perfectly secure, so please
                use a strong, unique password.
              </p>
            </Section>

            <Section n={7} title="Your choices and rights">
              <ul className="list-disc list-inside space-y-1.5">
                <li><strong className="text-slate-800">Edit</strong> your profile anytime in Settings.</li>
                <li><strong className="text-slate-800">Disconnect your LMS</strong> anytime; we stop syncing and you can delete the courses it added.</li>
                <li><strong className="text-slate-800">Turn off reminders</strong> in the app&apos;s Settings or your iPhone&apos;s notification settings.</li>
                <li><strong className="text-slate-800">Delete your account</strong> in Settings on the iPhone app or the website.</li>
                <li><strong className="text-slate-800">Request a copy</strong> of your information, or ask us to correct or delete it, by emailing <Mail />.</li>
              </ul>
              <p>
                Depending on where you live (for example California and other US states), you may have the right to know, access,
                correct and delete your personal information, and to not be discriminated against for using these rights. We
                don&apos;t sell personal information or share it for targeted advertising, so there is nothing to opt out of. To
                make a request, email <Mail />; we&apos;ll confirm it&apos;s you before acting on it.
              </p>
            </Section>

            <Section n={8} title="Age">
              <p>
                ClassMate is for college students and other adults; our Terms require you to be an adult where you live. We
                don&apos;t knowingly collect information from children under 13. If you believe a child has given us information,
                email <Mail /> and we&apos;ll delete it.
              </p>
            </Section>

            <Section n={9} title="Where your data is processed">
              <p>
                ClassMate is run from the United States, and your information is stored and processed in the United States by us
                and our service providers.
              </p>
            </Section>

            <Section n={10} title="Changes to this policy">
              <p>
                If we change this policy, we&apos;ll update the date at the top. If a change is significant, we&apos;ll tell you in
                the app or by email before it takes effect.
              </p>
            </Section>

            <Section n={11} title="Contact us">
              <p>
                Email <Mail />, or write to:
              </p>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-medium text-slate-800">Alexander Leporati (ClassMate)</p>
                <p className="mt-1">Charleston, SC 29403</p>
                <p>United States</p>
              </div>
            </Section>
          </div>

          <div className="mt-12 border-t border-slate-100 pt-6 text-sm text-slate-500 flex gap-4">
            <Link href="/terms" className="hover:text-[#5B8DEF]">Terms of Use</Link>
            <Link href="/support" className="hover:text-[#5B8DEF]">Support</Link>
          </div>
        </div>
      </div>
    </main>
  )
}
