# ClassMate iOS: launch checklist

Status as of 2026-10-04: the app is restyled to match tryclassmate.com (same header, bottom tabs, Inter font,
colors, course gradients, type badges) and covers the web's main features: Home dashboard, Courses (add/edit/
delete, syllabus upload), course detail (Timeline, Study Tools with flashcards/quiz/summary, Course Info, Notes),
Calendar (month list, day sheet, quick-add tasks), Chat (streaming), Profile & Settings, plus deadline push
reminders and a skippable paywall right after signup. Verified in the iOS Simulator against a local backend.
The RevenueCat backend webhook is written and tested (`Backend/test_revenuecat.py`), but it is
**committed only on the `mobile-backend-prep` branch and not deployed**.

Everything below needs the Apple Developer account unless marked "(now)".

## 1. Day one, slow items first

- [ ] **Paid Apps agreement + banking + tax** in App Store Connect → Business. IAP won't work until this
      is approved, and approval can take a few days. Start it first.
- [ ] Note the **Team ID** (Membership page).
- [ ] Decide the **bundle ID**: `com.tryclassmate.classmate` is set in `app.json`. It can't be changed
      after the first upload.
- [ ] Create the **App Store Connect app record**: name "ClassMate" (if taken, try "ClassMate: Syllabus Planner"),
      primary language English (US), SKU `classmate-ios`.

## 2. In-app purchase products (App Store Connect → Subscriptions)

Prices decided 2026-10-13, the same as the web (`Frontend/lib/pricing.ts`):

| Product ID | Type | Price | Intro offer |
|---|---|---|---|
| `classmate_pro_monthly` | Auto-renewable, group "ClassMate Pro", 1 month | $4.99 | none |
| `classmate_pro_semester` | Auto-renewable, same group, **6 months** ("Semester Pass") | $19.99 | 2-week free trial |

- [ ] Both products need a display name, description, and review screenshot (the paywall).
- [ ] Founding member is retired (existing grants are still honored); nothing one-time in the app.
- [ ] Introductory offer on the Semester Pass: 2-week free trial (the paywall reads eligibility from RevenueCat).

## 3. RevenueCat

- [ ] Create the project and add an iOS app with the bundle ID above.
- [ ] Upload the **In-App Purchase key (.p8)** from App Store Connect → Users and Access → Integrations.
- [ ] Import both products. Create the entitlement **`pro`** (must match `PRO_ENTITLEMENT` in `src/lib/config.ts`)
      and attach both products to it.
- [ ] Create the offering `default` with a monthly package and a **six-month** package (the paywall looks up
      `PACKAGE_TYPE.SIX_MONTH`), and design the paywall in the Paywalls
      editor. Keep the auto-included Terms/Privacy links, because Apple requires them on the paywall.
- [ ] Copy the **public iOS SDK key** (`appl_...`) into `eas.json` → each build profile's
      `env.EXPO_PUBLIC_REVENUECAT_IOS_KEY`. Until it's set, the app hides all upgrade UI.
- [ ] Integrations → Webhooks: URL `https://backend-production-c6a8.up.railway.app/revenuecat/webhook`,
      Authorization header = a long random string (`python3 -c "import secrets; print(secrets.token_hex(32))"`).

## 4. Backend deploy (ask Claude to do this together; every push to main rebuilds Railway)

- [ ] Set `REVENUECAT_WEBHOOK_AUTH` on Railway to the same string as the webhook header.
      Optional: `MOBILE_MIN_SUPPORTED_VERSION` / `MOBILE_LATEST_VERSION` (both default to 1.0.0).
- [ ] Merge `mobile-backend-prep` → `main`. The schema change is additive only (4 nullable columns on
      `user_profiles`, a new `revenuecat_webhook_events` table). No Stripe or auth behavior changes.
- [ ] Push reminders need nothing extra on Railway (they go through Expo's push service). Optional:
      `EXPO_ACCESS_TOKEN` if you turn on "enhanced push security" in Expo.
- [ ] Verify: `GET /app/config` returns 200; `POST /revenuecat/webhook` without auth returns 401; RevenueCat's
      "Send test event" returns 200.

## 5. Build and TestFlight

```bash
cd Mobile
npx eas-cli@latest login
npx eas-cli@latest init                 # links the EAS project, writes extra.eas.projectId into app.json (push tokens need this)
npx eas-cli@latest credentials -p ios   # let EAS create the APNs push key when asked
npx eas-cli@latest build -p ios --profile production
npx eas-cli@latest submit -p ios --latest
```

- [ ] EAS creates the distribution certificate and provisioning profile on the first build (sign in with your Apple ID when prompted).
- [ ] TestFlight: add yourself and a few CofC students as internal testers.
- [ ] **OAKS connect on a real iPhone** (the thing Expo Go can't prove): fresh install → onboarding →
      Sign in to OAKS → Microsoft + Authenticator on the same phone (switch to Authenticator and back)
      → "OAKS is connected". Then: kill the app mid-sign-in and retry; turn on Airplane mode at the
      "Finding your calendar" step (should show Try again); reopen the app next day and confirm due
      dates refresh. PostHog `lms_connect_step` should show opened → page_ready → signed_in →
      feed_found → connected.
- [ ] **Sandbox purchase test**: buy monthly in the TestFlight build with a Sandbox Apple ID → Settings shows
      "ClassMate Pro · Billed through the App Store", and `/me/subscription` returns `billing_source: "app_store"`.
      Then test Restore purchases on a second device, and cancel (Pro should last until expiry).

## 5b. Other schools (before any marketing outside CofC)

The connect script only uses standard Brightspace/Canvas features, but it's only been proven at CofC.
- [ ] Recruit 2–3 students at other **Brightspace/D2L** schools and 2–3 at **Canvas** schools as
      TestFlight external testers (external testing needs a quick Beta App Review).
- [ ] For each school note: LMS address, sign-in provider (Microsoft / Okta / Duo / Shibboleth /
      Google), and the furthest `lms_connect_step` reached. `feed_missed` events include which
      paths were tried (no tokens), which is what's needed to fix a school.
- [ ] Known gap: Google sign-in schools can't sign in inside apps; they use the paste fallback.
- [ ] Today the in-app sign-in starts at OAKS (`lms.cofc.edu`) or Canvas's generic login: picking a
      school's own LMS address ("Where do you go?") is the next build for non-CofC students.

## 6. App Store listing

- [ ] Screenshots: 6.9" (1320×2868) is required. Take them from the Simulator (iPhone 17 Pro Max) with real-looking data.
- [ ] Description must include links to the **Terms of Use (EULA)** and **Privacy Policy** (required for subscriptions).
- [ ] Support URL and privacy policy URL (`https://www.tryclassmate.com/privacy`).
- [ ] App Privacy labels: Contact info (email, name), User content (course materials, notes, chat), Identifiers (user ID),
      Purchases. All linked to the user, none used for tracking.
- [ ] Age rating questionnaire (expected 4+).
- [ ] **Review notes and a demo account** on production with seeded courses and deadlines (reviewers can't upload a syllabus).

## 7. Review risks (known)

- **4.2 Minimum functionality**: much lower risk now. The app has push reminders, syllabus upload, study tools,
  notes, and chat natively.
- **3.1.1 / 3.1.3**: The "More on the web" links open tryclassmate.com pages that show Stripe upgrade buttons.
  On the US storefront, linking out is allowed. To be conservative, either hide upgrade CTAs on the web when
  opened from the app (e.g. `?from=ios`) or drop those links for the review build.
- 5.1.1(v) account deletion: covered (Settings → Delete account).
- 4.8 Sign in with Apple: not required (email/password only, no third-party login).
- **LMS sign-in inside the app**: say in Review Notes that the school's own sign-in page is shown
  in an in-app browser, ClassMate never reads or stores the password (the script skips password
  fields), and only the student's own read-only calendar link is saved. Include a screen recording
  of the CofC flow, since reviewers can't sign in to OAKS. Paste-a-link fallback exists.

## Next (not built yet)

1. School picker so non-CofC Brightspace schools open their own LMS address (OAKS/Canvas connect is native now).
2. Profile photo upload, rich-text toolbar in notes (notes use markdown-style shortcuts that round-trip to the web editor).
3. Replace the placeholder App Store URL in the force-update screen (`src/app/_layout.tsx`) once the listing exists.
4. Test a real push on a device: Simulator/Expo Go can't receive remote pushes; use the TestFlight build.
5. Android.

## Local development

```bash
# backend on a scratch DB (never point the seed script at production; it refuses to)
cd Backend && DATABASE_URL=sqlite:///./mobile-dev.db JWT_SECRET=dev OPENAI_API_KEY=... venv_fresh/bin/python -m uvicorn main:app --port 8000
cd Mobile && python3 scripts/seed-local.py && npx expo start --go --ios
```

Expo Go runs RevenueCat in preview mode. Real purchases need a development or TestFlight build.
