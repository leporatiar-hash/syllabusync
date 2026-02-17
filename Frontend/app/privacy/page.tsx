'use client'

import Link from 'next/link'

export default function PrivacyPage() {
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
          <h1 className="text-3xl font-semibold text-slate-900">Privacy Policy</h1>
          <p className="mt-2 text-sm text-slate-500">Last updated February 17, 2026</p>

          <div className="mt-8 space-y-8 text-sm text-slate-600 leading-relaxed">
            {/* Intro */}
            <section>
              <p>
                This Privacy Notice for Alexander Leporati (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), describes how and why we might access, collect, store, use, and/or share (&quot;process&quot;) your personal information when you use our services (&quot;Services&quot;), including when you:
              </p>
              <ul className="mt-3 list-disc list-inside space-y-1.5">
                <li>
                  Visit our website at{' '}
                  <a href="http://tryclassmate.com" className="text-[#5B8DEF] hover:underline" target="_blank" rel="noopener noreferrer">
                    http://tryclassmate.com
                  </a>{' '}
                  or any website of ours that links to this Privacy Notice
                </li>
                <li>Engage with us in other related ways, including any marketing or events</li>
              </ul>
              <p className="mt-3">
                <strong className="text-slate-800">Questions or concerns?</strong> Reading this Privacy Notice will help you understand your privacy rights and choices. We are responsible for making decisions about how your personal information is processed. If you do not agree with our policies and practices, please do not use our Services. If you still have any questions or concerns, please contact us at{' '}
                <a href="mailto:leporatialex@gmail.com" className="text-[#5B8DEF] hover:underline">leporatialex@gmail.com</a>.
              </p>
            </section>

            {/* Summary of Key Points */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">Summary of Key Points</h2>
              <p className="italic text-slate-500 mb-4">
                This summary provides key points from our Privacy Notice, but you can find out more details about any of these topics by using our table of contents below to find the section you are looking for.
              </p>
              <div className="space-y-3">
                <p><strong className="text-slate-800">What personal information do we process?</strong> When you visit, use, or navigate our Services, we may process personal information depending on how you interact with us and the Services, the choices you make, and the products and features you use.</p>
                <p><strong className="text-slate-800">Do we process any sensitive personal information?</strong> We do not process sensitive personal information.</p>
                <p><strong className="text-slate-800">Do we collect any information from third parties?</strong> We do not collect any information from third parties.</p>
                <p><strong className="text-slate-800">How do we process your information?</strong> We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law. We may also process your information for other purposes with your consent.</p>
                <p><strong className="text-slate-800">In what situations and with which parties do we share personal information?</strong> We may share information in specific situations and with specific third parties.</p>
                <p><strong className="text-slate-800">How do we keep your information safe?</strong> We have adequate organizational and technical processes and procedures in place to protect your personal information. However, no electronic transmission over the internet or information storage technology can be guaranteed to be 100% secure.</p>
                <p><strong className="text-slate-800">What are your rights?</strong> Depending on where you are located geographically, the applicable privacy law may mean you have certain rights regarding your personal information.</p>
                <p><strong className="text-slate-800">How do you exercise your rights?</strong> The easiest way to exercise your rights is by submitting a data subject access request, or by contacting us.</p>
              </div>
            </section>

            {/* Table of Contents */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">Table of Contents</h2>
              <ol className="list-decimal list-inside space-y-1 text-slate-500">
                <li>What Information Do We Collect?</li>
                <li>How Do We Process Your Information?</li>
                <li>When and With Whom Do We Share Your Personal Information?</li>
                <li>Do We Use Cookies and Other Tracking Technologies?</li>
                <li>Do We Offer Artificial Intelligence-Based Products?</li>
                <li>How Do We Handle Your Social Logins?</li>
                <li>How Long Do We Keep Your Information?</li>
                <li>How Do We Keep Your Information Safe?</li>
                <li>Do We Collect Information From Minors?</li>
                <li>What Are Your Privacy Rights?</li>
                <li>Controls for Do-Not-Track Features</li>
                <li>Do United States Residents Have Specific Privacy Rights?</li>
                <li>Do We Make Updates to This Notice?</li>
                <li>How Can You Contact Us About This Notice?</li>
                <li>How Can You Review, Update, or Delete the Data We Collect From You?</li>
              </ol>
            </section>

            {/* 1 */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">1. What Information Do We Collect?</h2>
              <h3 className="font-semibold text-slate-800 mb-2">Personal information you disclose to us</h3>
              <p><em><strong>In Short:</strong> We collect personal information that you provide to us.</em></p>
              <p className="mt-3">We collect personal information that you voluntarily provide to us when you register on the Services, express an interest in obtaining information about us or our products and Services, when you participate in activities on the Services, or otherwise when you contact us.</p>
              <p className="mt-3"><strong className="text-slate-800">Personal Information Provided by You.</strong> The personal information that we collect depends on the context of your interactions with us and the Services, the choices you make, and the products and features you use. The personal information we collect may include the following:</p>
              <ul className="mt-2 list-disc list-inside space-y-1">
                <li>Names</li>
                <li>Email addresses</li>
                <li>Usernames</li>
                <li>Passwords</li>
                <li>Contact or authentication data</li>
              </ul>
              <p className="mt-3"><strong className="text-slate-800">Sensitive Information.</strong> We do not process sensitive information.</p>
              <p className="mt-3"><strong className="text-slate-800">Social Media Login Data.</strong> We may provide you with the option to register with us using your existing social media account details, like your Facebook, X, or other social media account. If you choose to register in this way, we will collect certain profile information about you from the social media provider, as described in the section called &quot;How Do We Handle Your Social Logins?&quot; below.</p>
              <p className="mt-3">All personal information that you provide to us must be true, complete, and accurate, and you must notify us of any changes to such personal information.</p>
            </section>

            {/* 2 */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">2. How Do We Process Your Information?</h2>
              <p><em><strong>In Short:</strong> We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law. We may also process your information for other purposes with your consent.</em></p>
              <p className="mt-3"><strong className="text-slate-800">We process your personal information for a variety of reasons, depending on how you interact with our Services, including:</strong></p>
              <ul className="mt-2 list-disc list-inside space-y-2">
                <li><strong>To facilitate account creation and authentication and otherwise manage user accounts.</strong> We may process your information so you can create and log in to your account, as well as keep your account in working order.</li>
                <li><strong>To deliver and facilitate delivery of services to the user.</strong> We may process your information to provide you with the requested service.</li>
                <li><strong>To respond to user inquiries/offer support to users.</strong> We may process your information to respond to your inquiries and solve any potential issues you might have with the requested service.</li>
                <li><strong>To send administrative information to you.</strong> We may process your information to send you details about our products and services, changes to our terms and policies, and other similar information.</li>
                <li><strong>To request feedback.</strong> We may process your information when necessary to request feedback and to contact you about your use of our Services.</li>
                <li><strong>To evaluate and improve our Services, products, marketing, and your experience.</strong> We may process your information when we believe it is necessary to identify usage trends, determine the effectiveness of our promotional campaigns, and to evaluate and improve our Services, products, marketing, and your experience.</li>
                <li><strong>To identify usage trends.</strong> We may process information about how you use our Services to better understand how they are being used so we can improve them.</li>
                <li><strong>To comply with our legal obligations.</strong> We may process your information to comply with our legal obligations, respond to legal requests, and exercise, establish, or defend our legal rights.</li>
              </ul>
            </section>

            {/* 3 */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">3. When and With Whom Do We Share Your Personal Information?</h2>
              <p><em><strong>In Short:</strong> We may share information in specific situations described in this section and/or with the following third parties.</em></p>
              <p className="mt-3">We may need to share your personal information in the following situations:</p>
              <ul className="mt-2 list-disc list-inside space-y-1.5">
                <li><strong>Business Transfers.</strong> We may share or transfer your information in connection with, or during negotiations of, any merger, sale of company assets, financing, or acquisition of all or a portion of our business to another company.</li>
              </ul>
            </section>

            {/* 4 */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">4. Do We Use Cookies and Other Tracking Technologies?</h2>
              <p><em><strong>In Short:</strong> We may use cookies and other tracking technologies to collect and store your information.</em></p>
              <p className="mt-3">We may use cookies and similar tracking technologies (like web beacons and pixels) to gather information when you interact with our Services. Some online tracking technologies help us maintain the security of our Services and your account, prevent crashes, fix bugs, save your preferences, and assist with basic site functions.</p>
              <p className="mt-3">We also permit third parties and service providers to use online tracking technologies on our Services for analytics and advertising, including to help manage and display advertisements, to tailor advertisements to your interests, or to send abandoned shopping cart reminders (depending on your communication preferences). The third parties and service providers use their technology to provide advertising about products and services tailored to your interests which may appear either on our Services or on other websites.</p>
              <p className="mt-3">To the extent these online tracking technologies are deemed to be a &quot;sale&quot;/&quot;sharing&quot; (which includes targeted advertising, as defined under the applicable laws) under applicable US state laws, you can opt out of these online tracking technologies by submitting a request as described below under section &quot;Do United States Residents Have Specific Privacy Rights?&quot;</p>
            </section>

            {/* 5 */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">5. Do We Offer Artificial Intelligence-Based Products?</h2>
              <p><em><strong>In Short:</strong> We offer products, features, or tools powered by artificial intelligence, machine learning, or similar technologies.</em></p>
              <p className="mt-3">As part of our Services, we offer products, features, or tools powered by artificial intelligence, machine learning, or similar technologies (collectively, &quot;AI Products&quot;). These tools are designed to enhance your experience and provide you with innovative solutions. The terms in this Privacy Notice govern your use of the AI Products within our Services.</p>
              <h3 className="font-semibold text-slate-800 mt-4 mb-2">Use of AI Technologies</h3>
              <p>We provide the AI Products through third-party service providers (&quot;AI Service Providers&quot;), including OpenAI. As outlined in this Privacy Notice, your input, output, and personal information will be shared with and processed by these AI Service Providers to enable your use of our AI Products. You must not use the AI Products in any way that violates the terms or policies of any AI Service Provider.</p>
              <h3 className="font-semibold text-slate-800 mt-4 mb-2">Our AI Products</h3>
              <p>Our AI Products are designed for the following functions:</p>
              <ul className="mt-2 list-disc list-inside">
                <li>AI automation</li>
              </ul>
              <h3 className="font-semibold text-slate-800 mt-4 mb-2">How We Process Your Data Using AI</h3>
              <p>All personal information processed using our AI Products is handled in line with our Privacy Notice and our agreement with third parties. This ensures high security and safeguards your personal information throughout the process, giving you peace of mind about your data&apos;s safety.</p>
            </section>

            {/* 6 */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">6. How Do We Handle Your Social Logins?</h2>
              <p><em><strong>In Short:</strong> If you choose to register or log in to our Services using a social media account, we may have access to certain information about you.</em></p>
              <p className="mt-3">Our Services offer you the ability to register and log in using your third-party social media account details (like your Facebook or X logins). Where you choose to do this, we will receive certain profile information about you from your social media provider. The profile information we receive may vary depending on the social media provider concerned, but will often include your name, email address, friends list, and profile picture, as well as other information you choose to make public on such a social media platform.</p>
              <p className="mt-3">We will use the information we receive only for the purposes that are described in this Privacy Notice or that are otherwise made clear to you on the relevant Services. Please note that we do not control, and are not responsible for, other uses of your personal information by your third-party social media provider. We recommend that you review their privacy notice to understand how they collect, use, and share your personal information, and how you can set your privacy preferences on their sites and apps.</p>
            </section>

            {/* 7 */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">7. How Long Do We Keep Your Information?</h2>
              <p><em><strong>In Short:</strong> We keep your information for as long as necessary to fulfill the purposes outlined in this Privacy Notice unless otherwise required by law.</em></p>
              <p className="mt-3">We will only keep your personal information for as long as it is necessary for the purposes set out in this Privacy Notice, unless a longer retention period is required or permitted by law (such as tax, accounting, or other legal requirements). No purpose in this notice will require us keeping your personal information for longer than the period of time in which users have an account with us.</p>
              <p className="mt-3">When we have no ongoing legitimate business need to process your personal information, we will either delete or anonymize such information, or, if this is not possible (for example, because your personal information has been stored in backup archives), then we will securely store your personal information and isolate it from any further processing until deletion is possible.</p>
            </section>

            {/* 8 */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">8. How Do We Keep Your Information Safe?</h2>
              <p><em><strong>In Short:</strong> We aim to protect your personal information through a system of organizational and technical security measures.</em></p>
              <p className="mt-3">We have implemented appropriate and reasonable technical and organizational security measures designed to protect the security of any personal information we process. However, despite our safeguards and efforts to secure your information, no electronic transmission over the Internet or information storage technology can be guaranteed to be 100% secure, so we cannot promise or guarantee that hackers, cybercriminals, or other unauthorized third parties will not be able to defeat our security and improperly collect, access, steal, or modify your information. Although we will do our best to protect your personal information, transmission of personal information to and from our Services is at your own risk. You should only access the Services within a secure environment.</p>
            </section>

            {/* 9 */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">9. Do We Collect Information From Minors?</h2>
              <p><em><strong>In Short:</strong> We do not knowingly collect data from or market to children under 18 years of age.</em></p>
              <p className="mt-3">We do not knowingly collect, solicit data from, or market to children under 18 years of age, nor do we knowingly sell such personal information. By using the Services, you represent that you are at least 18 or that you are the parent or guardian of such a minor and consent to such minor dependent&apos;s use of the Services. If we learn that personal information from users less than 18 years of age has been collected, we will deactivate the account and take reasonable measures to promptly delete such data from our records. If you become aware of any data we may have collected from children under age 18, please contact us at{' '}
                <a href="mailto:leporatialex@gmail.com" className="text-[#5B8DEF] hover:underline">leporatialex@gmail.com</a>.
              </p>
            </section>

            {/* 10 */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">10. What Are Your Privacy Rights?</h2>
              <p><em><strong>In Short:</strong> You may review, change, or terminate your account at any time, depending on your country, province, or state of residence.</em></p>
              <p className="mt-3"><strong className="text-slate-800">Withdrawing your consent:</strong> If we are relying on your consent to process your personal information, which may be express and/or implied consent depending on the applicable law, you have the right to withdraw your consent at any time. You can withdraw your consent at any time by contacting us by using the contact details provided in the section &quot;How Can You Contact Us About This Notice?&quot; below.</p>
              <p className="mt-3">However, please note that this will not affect the lawfulness of the processing before its withdrawal nor, when applicable law allows, will it affect the processing of your personal information conducted in reliance on lawful processing grounds other than consent.</p>
              <h3 className="font-semibold text-slate-800 mt-4 mb-2">Account Information</h3>
              <p>If you would at any time like to review or change the information in your account or terminate your account, you can:</p>
              <ul className="mt-2 list-disc list-inside space-y-1.5">
                <li>Log in to your account settings and update your user account.</li>
              </ul>
              <p className="mt-3">Upon your request to terminate your account, we will deactivate or delete your account and information from our active databases. However, we may retain some information in our files to prevent fraud, troubleshoot problems, assist with any investigations, enforce our legal terms and/or comply with applicable legal requirements.</p>
              <p className="mt-3"><strong className="text-slate-800">Cookies and similar technologies:</strong> Most Web browsers are set to accept cookies by default. If you prefer, you can usually choose to set your browser to remove cookies and to reject cookies. If you choose to remove cookies or reject cookies, this could affect certain features or services of our Services.</p>
              <p className="mt-3">If you have questions or comments about your privacy rights, you may email us at{' '}
                <a href="mailto:leporatialex@gmail.com" className="text-[#5B8DEF] hover:underline">leporatialex@gmail.com</a>.
              </p>
            </section>

            {/* 11 */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">11. Controls for Do-Not-Track Features</h2>
              <p>Most web browsers and some mobile operating systems and mobile applications include a Do-Not-Track (&quot;DNT&quot;) feature or setting you can activate to signal your privacy preference not to have data about your online browsing activities monitored and collected. At this stage, no uniform technology standard for recognizing and implementing DNT signals has been finalized. As such, we do not currently respond to DNT browser signals or any other mechanism that automatically communicates your choice not to be tracked online. If a standard for online tracking is adopted that we must follow in the future, we will inform you about that practice in a revised version of this Privacy Notice.</p>
              <p className="mt-3">California law requires us to let you know how we respond to web browser DNT signals. Because there currently is not an industry or legal standard for recognizing or honoring DNT signals, we do not respond to them at this time.</p>
            </section>

            {/* 12 */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">12. Do United States Residents Have Specific Privacy Rights?</h2>
              <p><em><strong>In Short:</strong> If you are a resident of certain US states, you may have the right to request access to and receive details about the personal information we maintain about you and how we have processed it, correct inaccuracies, get a copy of, or delete your personal information.</em></p>

              <h3 className="font-semibold text-slate-800 mt-4 mb-2">Categories of Personal Information We Collect</h3>
              <p>We have not collected any personal information in the categories listed below in the past twelve (12) months. This includes: identifiers, California Customer Records information, protected classification characteristics, commercial information, biometric information, internet activity, geolocation data, audio/electronic/sensory information, professional information, education information, inferences, and sensitive personal information.</p>

              <h3 className="font-semibold text-slate-800 mt-4 mb-2">Your Rights</h3>
              <p>You have rights under certain US state data protection laws. These rights include:</p>
              <ul className="mt-2 list-disc list-inside space-y-1.5">
                <li>Right to know whether or not we are processing your personal data</li>
                <li>Right to access your personal data</li>
                <li>Right to correct inaccuracies in your personal data</li>
                <li>Right to request the deletion of your personal data</li>
                <li>Right to obtain a copy of the personal data you previously shared with us</li>
                <li>Right to non-discrimination for exercising your rights</li>
                <li>Right to opt out of the processing of your personal data if it is used for targeted advertising, the sale of personal data, or profiling</li>
              </ul>

              <h3 className="font-semibold text-slate-800 mt-4 mb-2">How to Exercise Your Rights</h3>
              <p>To exercise these rights, you can contact us by emailing us at{' '}
                <a href="mailto:leporatialex@gmail.com" className="text-[#5B8DEF] hover:underline">leporatialex@gmail.com</a>
                , or by referring to the contact details at the bottom of this document.
              </p>

              <h3 className="font-semibold text-slate-800 mt-4 mb-2">Request Verification</h3>
              <p>Upon receiving your request, we will need to verify your identity to determine you are the same person about whom we have the information in our system. We will only use personal information provided in your request to verify your identity or authority to make the request.</p>

              <h3 className="font-semibold text-slate-800 mt-4 mb-2">Appeals</h3>
              <p>Under certain US state data protection laws, if we decline to take action regarding your request, you may appeal our decision by emailing us at{' '}
                <a href="mailto:leporatialex@gmail.com" className="text-[#5B8DEF] hover:underline">leporatialex@gmail.com</a>
                . We will inform you in writing of any action taken or not taken in response to the appeal, including a written explanation of the reasons for the decisions. If your appeal is denied, you may submit a complaint to your state attorney general.
              </p>

              <p className="mt-3">We have not disclosed, sold, or shared any personal information to third parties for a business or commercial purpose in the preceding twelve (12) months. We will not sell or share personal information in the future belonging to website visitors, users, and other consumers.</p>
            </section>

            {/* 13 */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">13. Do We Make Updates to This Notice?</h2>
              <p><em><strong>In Short:</strong> Yes, we will update this notice as necessary to stay compliant with relevant laws.</em></p>
              <p className="mt-3">We may update this Privacy Notice from time to time. The updated version will be indicated by an updated &quot;Revised&quot; date at the top of this Privacy Notice. If we make material changes to this Privacy Notice, we may notify you either by prominently posting a notice of such changes or by directly sending you a notification. We encourage you to review this Privacy Notice frequently to be informed of how we are protecting your information.</p>
            </section>

            {/* 14 */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">14. How Can You Contact Us About This Notice?</h2>
              <p>If you have questions or comments about this notice, you may email us at{' '}
                <a href="mailto:leporatialex@gmail.com" className="text-[#5B8DEF] hover:underline">leporatialex@gmail.com</a>
                {' '}or contact us by post at:
              </p>
              <div className="mt-3 rounded-2xl bg-slate-50 p-4">
                <p className="font-medium text-slate-800">Alexander Leporati</p>
                <p className="mt-1">Charleston, SC 29403</p>
                <p>United States</p>
              </div>
            </section>

            {/* 15 */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">15. How Can You Review, Update, or Delete the Data We Collect From You?</h2>
              <p>You have the right to request access to the personal information we collect from you, details about how we have processed it, correct inaccuracies, or delete your personal information. You may also have the right to withdraw your consent to our processing of your personal information. These rights may be limited in some circumstances by applicable law. To request to review, update, or delete your personal information, please contact us at{' '}
                <a href="mailto:leporatialex@gmail.com" className="text-[#5B8DEF] hover:underline">leporatialex@gmail.com</a>.
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}
