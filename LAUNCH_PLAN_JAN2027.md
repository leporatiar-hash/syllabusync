# ClassMate launch plan: first week of January 2027

Goal of the launch: students install the iPhone app, connect their LMS, allow notifications, and get
reminded before things are due. Spring targets (from Nov 27): live by Jan 15 at the latest, 200 installs,
60% connect + allow notifications, 10 paying students by May.

Budget: $0. Time: about 5 hours a week from Alexander; Claude drafts, builds and reports, Alexander
approves and posts anything public.

---

## 1. App Store screenshots

Apple shows the first 3 screenshots in search results, so those 3 have to sell the app on their own.
Required size: 6.9" (1320 × 2868), taken from the iPhone 17 Pro Max simulator. Up to 10 allowed; use 6.

Style for all of them:
- Solid brand-blue background (#3B6FE0 → slightly lighter at the bottom), the phone screen centered,
  a short caption above it in white, 2 lines max, 7 words or fewer per line.
- Real-looking demo data from a demo account (a made-up student at a made-up "State University"
  is safest; real course codes like PSYC 103 are fine). No fake ratings, reviews or user counts.
- Every caption is a benefit, not a feature name.

| # | Screen | Caption |
|---|--------|---------|
| 1 | Lock screen with two ClassMate notifications ("Midterm in 7 days", "Due tomorrow: Problem Set 6") | **Never get caught off guard by a due date** |
| 2 | Today screen: summary line + a few days of deadlines with class colors and an EXAM tag | **Every deadline, from every class, in one place** |
| 3 | School picker → "Sign in to Canvas" (split image) | **Pick your school. Sign in once. Done.** |
| 4 | Reminder settings (once "choose when you're reminded" ships) | **Reminders when you want them** |
| 5 | Calendar month view with colored dots + day sheet | **Your whole semester at a glance** |
| 6 | Course page: syllabus info (professor, office hours, grading) | **Office hours and grading, pulled from your syllabus** |

Optional 7th, only once the ChatGPT/Claude connector is approved: a chat bubble "What's due this week?"
answered with real deadlines. Caption: **Ask your AI what's due**. Don't show the ChatGPT or Claude logos
in the screenshot unless their brand rules allow it; say "works with" in the description instead.

How to make them: seed the demo account (also needed for App Review), take simulator screenshots,
then add the background and caption in Canva (free; the Canva connector is set up) or Figma.
Claude can do the seeding, screenshots and Canva layout; Alexander approves the final six.

Decide the lowercase "classmate" question BEFORE making these: the name is baked into screenshot 1
and the icon caption.

---

## 2. Getting it in front of people for $0

Ranked by expected installs per hour of Alexander's time.

### A. People who already use ClassMate (week of launch)
- **Email the ~300 web users**: "ClassMate is on iPhone: get reminded before every deadline." One email,
  one link, sent the day the app is live. Claude drafts, Alexander approves. Highest-yield thing on this list.
- **In-app share after the first useful reminder**: "ClassMate just saved you on Problem Set 6. Know
  someone who'd want this?" (share sheet with the App Store link). Ask once, never again.

### B. Show up when students ask ChatGPT or Claude (ongoing, mostly Claude's work)
Last semester ChatGPT sent the most users. AI assistants recommend what they can find clearly
described on the web, so:
- **Answer pages on tryclassmate.com**, one per real question, plain language, with the price and
  supported LMSs stated outright:
  - "Get Canvas due date reminders on your iPhone"
  - "Sync Brightspace (D2L) assignments to your phone"
  - "Blackboard assignment reminders"
  - "Best app to keep track of assignments in college"
  - "How to never miss a due date in college"
- **App Store listing live and complete**: AI answers and search engines link to App Store pages.
- **ChatGPT app + Claude connector listings** (in progress): being listed inside ChatGPT and Claude is
  itself a discovery channel.
- **Honest third-party mentions**: Reddit answers (below) and student "best apps" posts are what
  assistants read and cite.

### C. Campus, starting at CofC (January, first two weeks of class)
- **Center for Student Learning** (Kait Lamontagne): ask for one thing only: a mention in their
  start-of-semester email or tutoring-center screens. Verbal interest doesn't count; a sent email does.
- **RAs and orientation leaders**: a 2-sentence message they can paste into hall GroupMes.
- **Student orgs you're in or know** (finance club, Greek life, intramurals): one post each.
- **Flyers with a QR code** in the library, Stern Center and dining hall: free to print on campus.
- **Student newspaper / CisternYard**: pitch the founder story ("CofC student built the app that
  reminds you before deadlines").
- **r/CofC** and other school subreddits: one founder post, transparent that you built it.

### D. Reddit and student communities (30 min/week)
- Answer real questions in r/college, r/GetStudying, r/college_tips and school subreddits when someone
  asks how to keep track of assignments. Say you built it. Never astroturf, never post fake reviews.
- Claude finds threads and drafts replies; Alexander edits and posts.

### E. Short video (1 hour/week, batch-filmed)
- TikTok, Reels and YouTube Shorts from the same clips. Screen recordings with a text hook:
  - "POV: your professor moved the due date and your phone told you before you did"
  - "I connected Canvas once and now I get reminded before everything"
  - "Setting up my spring semester in 60 seconds"
- Post 3 a week from the first week of January through midterms. Claude writes scripts and captions.

### F. One-time launches (launch week)
- **Product Hunt**: free, a small spike, good for backlinks that AI assistants read.
- **Indie/student founder communities** (Indie Hackers, school entrepreneurship groups, Launch X).

### Timing
- **Jan 5–16 (semester start)**: "set up your semester" moment. Email, campus, Reddit, Product Hunt.
- **Late Feb–March (midterms)** and **late April (finals)**: the moments students feel the pain;
  that's when the exam-week Pro card and videos about exams go out.

---

## 3. What we measure (weekly report from Claude, Mondays)
- Installs, and where they came from (App Store search, web link, referral)
- % who connect an LMS, % who allow notifications
- Reminders sent; reminders opened
- Trial starts, paid conversions
- Which channel above produced the most installs per hour spent; drop the bottom one each month.

---

## 4. Open decisions for Alexander
1. Lowercase "classmate" rebrand: yes or no, before screenshots are made.
2. Is the free-Pro promo (PROMO_PRO_UNTIL on the server) on? If so, when does it end?
3. Which channels you're personally willing to do (video on camera or screen-only; Reddit under your name).
