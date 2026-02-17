'use client'

import Link from 'next/link'

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#F5F7FA] to-[#E8EDFB]">
      <div className="mx-auto max-w-4xl px-4 py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-[#5B8DEF] transition-colors mb-8"
        >
          ← Back to home
        </Link>

        <div className="rounded-3xl bg-white p-8 md:p-12 shadow-sm">
          <h1 className="text-3xl font-semibold text-slate-900">Terms of Use</h1>
          <p className="mt-2 text-sm text-slate-500">Last updated February 17, 2026</p>

          <div className="mt-8 space-y-8 text-sm text-slate-600 leading-relaxed">
            {/* Agreement */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">Agreement to Our Legal Terms</h2>
              <p>
                We are Alexander Leporati, doing business as ClassMate (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; &quot;our&quot;).
              </p>
              <p className="mt-3">
                We operate the website{' '}
                <a href="http://tryclassmate.com" className="text-[#5B8DEF] hover:underline" target="_blank" rel="noopener noreferrer">
                  http://tryclassmate.com
                </a>
                , as well as any other related products and services that refer or link to these legal terms (the &quot;Legal Terms&quot;) (collectively, the &quot;Services&quot;).
              </p>
              <p className="mt-3">
                You can contact us by email at{' '}
                <a href="mailto:leporatialex@gmail.com" className="text-[#5B8DEF] hover:underline">
                  leporatialex@gmail.com
                </a>.
              </p>
              <p className="mt-3">
                These Legal Terms constitute a legally binding agreement made between you, whether personally or on behalf of an entity (&quot;you&quot;), and Alexander Leporati (DBA ClassMate), concerning your access to and use of the Services. You agree that by accessing the Services, you have read, understood, and agreed to be bound by all of these Legal Terms. IF YOU DO NOT AGREE WITH ALL OF THESE LEGAL TERMS, THEN YOU ARE EXPRESSLY PROHIBITED FROM USING THE SERVICES AND YOU MUST DISCONTINUE USE IMMEDIATELY.
              </p>
              <p className="mt-3">
                We reserve the right, in our sole discretion, to make changes or modifications to these Legal Terms at any time and for any reason. We will alert you about any changes by updating the &quot;Last updated&quot; date of these Legal Terms. You will be subject to the changes in any revised Legal Terms by your continued use of the Services after the date such revised Legal Terms are posted.
              </p>
            </section>

            {/* Table of Contents */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">Table of Contents</h2>
              <ol className="list-decimal list-inside space-y-1 text-slate-500">
                <li>Our Services</li>
                <li>Intellectual Property Rights</li>
                <li>User Representations</li>
                <li>Prohibited Activities</li>
                <li>User Generated Contributions</li>
                <li>Contribution License</li>
                <li>Services Management</li>
                <li>Term and Termination</li>
                <li>Modifications and Interruptions</li>
                <li>Governing Law</li>
                <li>Dispute Resolution</li>
                <li>Corrections</li>
                <li>Disclaimer</li>
                <li>Limitations of Liability</li>
                <li>Indemnification</li>
                <li>User Data</li>
                <li>Electronic Communications, Transactions, and Signatures</li>
                <li>Miscellaneous</li>
                <li>Contact Us</li>
              </ol>
            </section>

            {/* 1. Our Services */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">1. Our Services</h2>
              <p>
                The information provided when using the Services is not intended for distribution to or use by any person or entity in any jurisdiction or country where such distribution or use would be contrary to law or regulation. Those who choose to access the Services from other locations do so on their own initiative and are solely responsible for compliance with local laws.
              </p>
            </section>

            {/* 2. Intellectual Property Rights */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">2. Intellectual Property Rights</h2>
              <p>
                We are the owner or licensee of all intellectual property rights in our Services, including all source code, databases, functionality, software, website designs, audio, video, text, photographs, and graphics (collectively, the &quot;Content&quot;), as well as the trademarks, service marks, and logos contained therein (the &quot;Marks&quot;).
              </p>
              <p className="mt-3">Our Content and Marks are protected by copyright and trademark laws and treaties around the world.</p>
              <p className="mt-3">Subject to your compliance with these Legal Terms, we grant you a non-exclusive, non-transferable, revocable license to access the Services solely for your personal, non-commercial use.</p>
              <p className="mt-3">Any breach of these Intellectual Property Rights will constitute a material breach of our Legal Terms and your right to use our Services will terminate immediately.</p>
            </section>

            {/* 3. User Representations */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">3. User Representations</h2>
              <p>
                By using the Services, you represent and warrant that: (1) you have the legal capacity and agree to comply with these Legal Terms; (2) you are not a minor in the jurisdiction in which you reside; (3) you will not access the Services through automated or non-human means; (4) you will not use the Services for any illegal or unauthorized purpose; and (5) your use of the Services will not violate any applicable law or regulation.
              </p>
            </section>

            {/* 4. Prohibited Activities */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">4. Prohibited Activities</h2>
              <p>You may not access or use the Services for any purpose other than that for which we make the Services available. As a user of the Services, you agree not to:</p>
              <ul className="mt-3 list-disc list-inside space-y-1.5">
                <li>Systematically retrieve data to create databases or directories without written permission</li>
                <li>Trick, defraud, or mislead us and other users</li>
                <li>Circumvent or interfere with security-related features of the Services</li>
                <li>Use the Services in a manner inconsistent with any applicable laws or regulations</li>
                <li>Upload or transmit viruses, Trojan horses, or other harmful material</li>
                <li>Engage in any automated use of the system without permission</li>
                <li>Attempt to impersonate another user or person</li>
                <li>Use the Services as part of any effort to compete with us</li>
              </ul>
            </section>

            {/* 5. User Generated Contributions */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">5. User Generated Contributions</h2>
              <p>
                The Services may provide you with the opportunity to create, submit, or post content (&quot;Contributions&quot;). When you create or make available any Contributions, you represent and warrant that you have the necessary rights to do so and that your Contributions do not violate any third-party rights.
              </p>
            </section>

            {/* 6. Contribution License */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">6. Contribution License</h2>
              <p>
                By submitting suggestions or other feedback regarding the Services, you agree that we can use and share such feedback for any purpose without compensation to you. You retain full ownership of your Contributions and any associated intellectual property rights.
              </p>
            </section>

            {/* 7. Services Management */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">7. Services Management</h2>
              <p>
                We reserve the right to: (1) monitor the Services for violations of these Legal Terms; (2) take appropriate legal action against anyone who violates the law or these Legal Terms; (3) restrict access to or disable any Contributions; and (4) otherwise manage the Services to protect our rights and facilitate proper functioning.
              </p>
            </section>

            {/* 8. Term and Termination */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">8. Term and Termination</h2>
              <p>
                These Legal Terms shall remain in full force and effect while you use the Services. We reserve the right to deny access to and use of the Services to any person for any reason, including breach of these Legal Terms. If we terminate or suspend your account, you are prohibited from registering a new account without our permission.
              </p>
            </section>

            {/* 9. Modifications and Interruptions */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">9. Modifications and Interruptions</h2>
              <p>
                We reserve the right to change, modify, or remove the contents of the Services at any time without notice. We cannot guarantee the Services will be available at all times and are not liable for any downtime or discontinuance of the Services.
              </p>
            </section>

            {/* 10. Governing Law */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">10. Governing Law</h2>
              <p>
                These Legal Terms shall be governed by the laws of the State of South Carolina, United States. You irrevocably consent that the courts of South Carolina shall have exclusive jurisdiction to resolve any dispute arising in connection with these Legal Terms.
              </p>
            </section>

            {/* 11. Dispute Resolution */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">11. Dispute Resolution</h2>
              <p>
                <strong className="text-slate-800">Informal Negotiations:</strong> The parties agree to first attempt to negotiate any dispute informally for at least 30 days before initiating arbitration.
              </p>
              <p className="mt-3">
                <strong className="text-slate-800">Binding Arbitration:</strong> Any dispute arising out of or in connection with these Legal Terms shall be referred to and finally resolved by binding arbitration. The seat of arbitration shall be Charleston, South Carolina. The language of the proceedings shall be English. The governing law shall be the substantive law of South Carolina.
              </p>
              <p className="mt-3">
                <strong className="text-slate-800">Restrictions:</strong> Any arbitration shall be limited to the dispute between the parties individually. No arbitration shall be joined with any other proceeding, and there is no right to arbitrate on a class-action basis.
              </p>
            </section>

            {/* 12. Corrections */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">12. Corrections</h2>
              <p>
                We reserve the right to correct any errors, inaccuracies, or omissions and to change or update information on the Services at any time without prior notice.
              </p>
            </section>

            {/* 13. Disclaimer */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">13. Disclaimer</h2>
              <p className="uppercase font-medium text-slate-700">
                The Services are provided on an as-is and as-available basis. To the fullest extent permitted by law, we disclaim all warranties, express or implied, including the implied warranties of merchantability, fitness for a particular purpose, and non-infringement. We make no warranties about the accuracy or completeness of the Services&apos; content and will assume no liability for any errors, personal injury, unauthorized access, interruption of transmission, or other damages arising from your use of the Services.
              </p>
            </section>

            {/* 14. Limitations of Liability */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">14. Limitations of Liability</h2>
              <p className="uppercase font-medium text-slate-700">
                In no event will we or our agents be liable to you for any direct, indirect, consequential, incidental, special, or punitive damages, including lost profit, lost revenue, or loss of data arising from your use of the Services. Our liability to you for any cause whatsoever will at all times be limited to the amount paid, if any, by you to us.
              </p>
            </section>

            {/* 15. Indemnification */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">15. Indemnification</h2>
              <p>
                You agree to defend, indemnify, and hold us harmless from and against any loss, damage, liability, claim, or demand arising out of: (1) your use of the Services; (2) breach of these Legal Terms; (3) any breach of your representations and warranties; or (4) your violation of the rights of a third party.
              </p>
            </section>

            {/* 16. User Data */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">16. User Data</h2>
              <p>
                We will maintain certain data that you transmit to the Services for the purpose of managing performance. Although we perform regular backups, you are solely responsible for all data that you transmit. We shall have no liability to you for any loss or corruption of such data.
              </p>
            </section>

            {/* 17. Electronic Communications */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">17. Electronic Communications, Transactions, and Signatures</h2>
              <p>
                Visiting the Services, sending us emails, and completing online forms constitute electronic communications. You consent to receive electronic communications and agree that all agreements, notices, and other communications we provide electronically satisfy any legal requirement that such communications be in writing.
              </p>
            </section>

            {/* 18. Miscellaneous */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">18. Miscellaneous</h2>
              <p>
                These Legal Terms and any policies posted by us on the Services constitute the entire agreement between you and us. If any provision of these Legal Terms is determined to be unlawful or unenforceable, that provision is deemed severable and does not affect the validity of any remaining provisions. There is no joint venture, partnership, employment, or agency relationship created between you and us as a result of these Legal Terms.
              </p>
            </section>

            {/* 19. Contact Us */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">19. Contact Us</h2>
              <p>To resolve a complaint regarding the Services or to receive further information, please contact us:</p>
              <div className="mt-3 rounded-2xl bg-slate-50 p-4">
                <p className="font-medium text-slate-800">Alexander Leporati (DBA ClassMate)</p>
                <p className="mt-1">
                  Email:{' '}
                  <a href="mailto:leporatialex@gmail.com" className="text-[#5B8DEF] hover:underline">
                    leporatialex@gmail.com
                  </a>
                </p>
                <p className="mt-1">
                  Website:{' '}
                  <a href="http://tryclassmate.com" className="text-[#5B8DEF] hover:underline" target="_blank" rel="noopener noreferrer">
                    http://tryclassmate.com
                  </a>
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}
