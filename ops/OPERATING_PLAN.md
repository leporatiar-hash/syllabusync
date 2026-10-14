# ClassMate operating plan

Written 2026-10-13. Alex is moving their focus to Advocate. ClassMate should run mostly on its own,
with Claude as the operator, and earn passive income once the iPhone app launches. This file is the
playbook: what ClassMate is, who does what, and the plan for the next year.

## What ClassMate is now

**"Never get caught off guard by a due date."**
- ClassMate pulls every deadline from the student's LMS (Canvas or Brightspace/D2L) and their
  syllabi into one calendar.
- It reminds them before things are due, and tells them when a professor moves a date.
- The LMS is the source of truth for due dates. Syllabi supply course info: policies, office hours,
  exams.

| | Free | Pro ($4.99/mo or $19.99 Semester Pass every 6 months) |
|---|---|---|
| LMS sync, syllabus reading, calendar | yes | yes |
| Reminder the night before | yes | yes |
| Alert when a due date changes or a new item is posted | | yes |
| 3-day heads-up, exam-week warning | | yes |
| Sunday game plan | | yes |
| Flashcards/quizzes/summaries | 50/month | unlimited |

**Promises we keep:**
- 14-day full refund, no questions asked.
- Free access for anyone who can't afford it.
- 529-friendly receipts.
- No ads, no selling data.

**Why people pay:** peace of mind ("insurance"), often paid by parents. It isn't the AI; students
already have ChatGPT.

## Who does what

**Claude, without asking:**
- Daily 9am check-in voicemail (`classmate-daily-voicemail`): server, LMS sync, website, Stripe,
  Sentry, the hello@ inbox.
- Drafts replies to every support email (never sends them).
- Investigates errors, writes fixes on a branch, and runs the full test suite.
- Dependency and security updates on a branch, with tests.
- Keeps this file, `Mobile/LAUNCH_CHECKLIST.md` and the memory notes current.

**Claude, with a one-tap yes from Alex:**
- Sending a support reply.
- Any refund or credit.
- Deploying to production. Proposed later rule: bug fixes that pass all tests deploy automatically,
  with a 10-minute watch and auto-rollback.
- Price changes, new Stripe prices, App Store submissions, anything students would notice.

**Alex only:**
- Apple developer account: agreements, banking/tax forms, in-app purchase products.
- LLC, taxes, lawyer review (`legal/DRAFT_POLICY_UPDATES.md`), Porkbun billing.
- Big product direction.

## Systems

| What | Where | Notes |
|---|---|---|
| Backend | Railway "ClassMate" / Backend | Deploys on push to `main`. Deps pinned to prod versions; never unpin. |
| Website | Vercel `syllabusync` | Deploys on push to `main`. |
| Database | Railway Postgres | Back it up before risky deploys. |
| Email | Resend: noreply@ (sending), hello@ (inbox) | DNS at Porkbun. |
| Payments | Stripe (web), RevenueCat + App Store (iPhone) | |
| Push | Expo push service | |
| App builds | Expo/EAS | Project ID set via `eas init`. |
| Analytics | PostHog | |
| Errors | Sentry (set up a ClassMate project + DSNs) | |

## The plan

### Now → December 20 (free Pro for everyone)
- Ship the branch (`mobile-backend-prep`) to the web in stages:
  1. Back up the database.
  2. Create the new Stripe prices.
  3. Set `PROMO_PRO_UNTIL=2026-12-20` and `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_SEMESTER`.
  4. Deploy the backend and watch it.
  5. Deploy the web and watch it.
- Collect feedback (the in-app survey is on the branch) and read it before January.
- Set up the remaining safety nets:
  - GitHub CLI, then automatic tests on every push.
  - Sentry DSNs.
  - An uptime monitor.

### December → January launch
- Apple account arrives:
  1. Products: monthly $4.99, six-month $19.99 with a 2-week trial.
  2. RevenueCat.
  3. TestFlight with ~10 CofC students.
  4. App Store review.
- Launch in the App Store before the spring semester starts. Students set up in the first week of
  classes, so the timing matters more than polish.
- December 20: the promo ends, and free users drop to the night-before reminder. Two weeks before,
  email everyone with what changes and the Semester Pass.

### Spring semester
- Family plan: the student invites a parent, who pays. The parent sees only what the student shares
  (wins, a weekly summary) and can send encouragement. Parents get 529-ready receipts.
- Lifecycle email, all automatic: week-one setup help, mid-semester check-in, finals-week plan.
- Grow through the channel that already works: ChatGPT and Google referrals. Keep the landing page
  and FAQ answering the questions students actually ask.

### Steady state (the passive part)
Expected human time: about 1–2 hours a month, plus a few hours each in August, January and
September.
- **August and January:** semester starts bring new signups and school LMS changes. Claude watches
  more closely.
- **September:** the new iOS release. Rebuild and resubmit the app.
- **Yearly:** Apple $99, domain, LLC filing, taxes.

## Rough economics
- Costs: about $25–60/month (Railway, Vercel free tier, OpenAI, Resend, the domain), plus Apple at
  $99/year.
- At 1,000 users with 5% paying about $3.50/month on average after Apple's 15%: roughly $175/month.
- At 5,000 users and 6%: roughly $1,000/month.
- It grows with each semester's word of mouth, which is the passive-income path.
