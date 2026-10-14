# ClassMate: draft policy updates (for lawyer review, NOT live)

Drafted October 2026 for the January app launch. Nothing here is on the site yet. The live pages are
`Frontend/app/terms/page.tsx` and `Frontend/app/privacy/page.tsx`. Once reviewed, the text below goes
into those pages and the "Last updated" dates change.

**Not legal advice.** These are plain-language drafts based on what the product actually does, so a
lawyer can review real text instead of starting from scratch.

---

## 0. Global changes

- **Operator name:** replace "Alexander Leporati (DBA ClassMate)" with the LLC's legal name once it's
  formed (for example "ClassMate LLC, a South Carolina limited liability company").
- **Contact:** hello@tryclassmate.com.
- **Remove advertising boilerplate (Privacy section 4).** The current text says third parties use
  tracking "for analytics and advertising ... to tailor advertisements." ClassMate runs no ads and sells
  no data. Replace it with the text in section 2.4 below. The App Store privacy labels must match.

---

## 1. Terms of Service: new sections

### 1.1 Subscriptions and billing (new section, after "Services Management")

> **Free and paid plans.** ClassMate's core features are free: connecting your school's LMS, seeing all
> of your classes and due dates, the calendar, and a reminder the day before each deadline. ClassMate
> Pro is an optional paid plan with extra features (for example earlier reminders, weekly plans, and
> unlimited study tools).
>
> **Prices and renewal.** Pro is offered as a monthly plan or a Semester Pass that renews every 6 months.
> The price and how often it renews are shown before you pay. **Paid plans renew automatically at the
> same price until you cancel.** If we ever change the price, we'll tell you at least 30 days before it
> applies to you, and you can cancel before then.
>
> **Free trials and promotions.** If a plan includes a free trial, we'll tell you how long it lasts and
> remind you before it ends. When a free promotion ends (for example "Pro free for everyone through
> December 20"), your account returns to the free plan. You are never charged unless you choose a
> paid plan.
>
> **Canceling.** You can cancel anytime. On the web: Settings → Manage Subscription. On iPhone: Settings
> → your name → Subscriptions. You keep Pro until the end of the period you already paid for.
>
> **Where you paid.** Purchases on our website are processed by Stripe. Purchases in the iPhone app are
> processed by Apple under Apple's terms, and Apple handles those refunds.

### 1.2 Refunds (new section)

> **14-day refund, no questions asked.** If you're not happy, email hello@tryclassmate.com within 14 days
> of a charge on our website and we'll refund it in full. App Store purchases are refunded by Apple at
> reportaproblem.apple.com. We may refund later charges at our discretion.
>
> **Can't afford it?** Email us. We offer free access to students who need it.

### 1.3 The "never surprised" guarantee (only if adopted; wording must match the product exactly)

> If a deadline was in your ClassMate calendar with reminders turned on, and ClassMate failed to send
> the reminder it was supposed to, email us within 30 days and we'll refund your current billing period.
> This guarantee covers our reminders, not your grades, your school's systems, or changes your school
> made without updating its calendar.

### 1.4 Connecting your LMS (add to "Our Services")

> ClassMate can read your own course calendar from your school's learning management system (for example
> Brightspace/D2L or Canvas) when you connect it. In the iPhone app you sign in to your school's own
> sign-in page; ClassMate does not see or store your school password. We store a read-only calendar link
> (encrypted) so your due dates stay up to date. ClassMate never changes anything in your LMS. You can
> disconnect anytime in Settings. You're responsible for making sure connecting complies with your
> school's policies, and due dates are only as accurate as your school's calendar.

### 1.5 Accuracy (add to "Disclaimer")

> ClassMate pulls deadlines from your LMS and uses AI to read syllabi. We work hard on accuracy, but we
> can make mistakes. Your course materials and instructors are the final word on due dates and policies.

### 1.6 School names and logos (add to "Intellectual Property")

> School names and logos belong to their schools and are shown only to help you find your school.
> ClassMate is not affiliated with or endorsed by any school unless we say so. Schools can ask us to
> remove their logo at hello@tryclassmate.com.

### 1.7 Age (keep, but make consistent)

The Terms say users must not be minors and the Privacy Policy says 18+. Decide 18+ (current) or 13+
(if high school or dual-enrollment students are in scope). See the questions below.

---

## 2. Privacy Policy: updates

### 2.1 What we collect (add to section 1)

- **Account:** email, name, school, year in school, how you heard about us.
- **Course data you give us:** syllabi you upload, notes, courses, deadlines and to-dos.
- **LMS calendar:** if you connect your LMS, a read-only calendar link (stored encrypted) and the course
  and due-date information in that calendar. We don't receive your school password or grades.
- **Phone app:** a push-notification token and your time zone, so reminders arrive at the right time.
- **Purchases:** plan and billing status. Card details are handled by Stripe or Apple; we never see full
  card numbers.
- **Feedback:** survey answers you choose to submit, including a phone number or email if you ask us to
  contact you.
- **Usage analytics:** which features are used (via PostHog), to improve the product.

### 2.2 Who processes it (update section 3: service providers only, no sale)

Hosting (Railway, Vercel), AI processing (OpenAI, for syllabus reading, study tools and chat),
analytics (PostHog), payments (Stripe, Apple, RevenueCat), email (Resend), push notifications (Expo /
Apple). **We do not sell your personal information or share it for advertising.**

### 2.3 Sharing you control (new; for the family feature when it launches)

> If you choose to share with a parent or someone else, they see only what you turn on (for example
> "tasks completed" or a weekly summary). They never see grades or your full calendar unless you share
> it, and you can stop sharing anytime.

### 2.4 Cookies and tracking (replace section 4)

> We use cookies and similar technology to keep you signed in and to understand how ClassMate is used
> (product analytics). We don't use advertising cookies, don't show ads, and don't allow third parties
> to track you on ClassMate for advertising.

### 2.5 Security (add to section 8)

> Calendar links and LMS access tokens are encrypted at rest. Access to our systems is limited and
> protected with strong authentication.

### 2.6 Deleting your data (section 15)

> You can delete your account in Settings (web and iPhone). This removes your courses, deadlines, notes,
> LMS connections and push tokens.

---

## 3. Other copy that needs the same review

- **529 line** (upgrade page, receipts, confirmation email): "May be paid with 529 college savings
  (educational software used by the student). Check with your plan or a tax professional; this isn't
  tax advice." Never "tax-free" or "guaranteed."
- **Checkout text** (Stripe, above Pay): "Renews automatically every [month / 6 months] until you cancel.
  Cancel anytime in ClassMate Settings. Full refund within 14 days, no questions asked."
- **Confirmation email** after purchase (plan, price, renewal, how to cancel, refund, 529 note).

---

## 4. Questions for the lawyer

1. Is the subscription section enough for federal (ROSCA) and state auto-renewal laws (CA, NY) for monthly
   and 6-month plans sold on the web? Do we need annual or pre-renewal reminder emails for 6-month plans?
2. Age: 18+ only, or 13+? What changes if dual-enrollment high schoolers sign up?
3. Is the LMS-connect language (student signs in on the school's page, we store an encrypted read-only
   calendar link) sufficient? Any concern with schools' acceptable-use policies?
4. Is the "never surprised" guarantee wording safe and clear enough to advertise?
5. Is "may qualify for 529" wording acceptable in marketing and on receipts?
6. School logos in the school picker: OK as nominative use with the non-affiliation line?
7. Family sharing (student-initiated, revocable, no grades): anything required beyond the privacy text?
8. Dispute resolution (current section 11): keep arbitration or small claims? Governing law: South Carolina?
9. Anything needed before adding text-message reminders later (TCPA consent language)?
10. Sales tax on web subscriptions: when to register and in which states?
