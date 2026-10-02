# ClassMate iOS: launch checklist

Status as of 2026-10-02: the app runs end to end in the iOS Simulator against a local backend
(login, Home, Calendar, Courses, course detail, streaming Chat, Settings, deadline completion).
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

Match the web prices so nobody is penalized for which store they used:

| Product ID | Type | Price | Web equivalent |
|---|---|---|---|
| `classmate_pro_monthly` | Auto-renewable, group "ClassMate Pro" | $4.99 | $5/mo Stripe |
| `classmate_pro_yearly` | Auto-renewable, same group | $39.99 | $40/yr Stripe |

- [ ] Both products need a display name, description, and review screenshot (the paywall).
- [ ] The founding-member $15 one-time stays **web-only** for v1.
- [ ] Optional: introductory offer (1-week free trial) on yearly.

## 3. RevenueCat

- [ ] Create the project and add an iOS app with the bundle ID above.
- [ ] Upload the **In-App Purchase key (.p8)** from App Store Connect → Users and Access → Integrations.
- [ ] Import both products. Create the entitlement **`pro`** (must match `PRO_ENTITLEMENT` in `src/lib/config.ts`)
      and attach both products to it.
- [ ] Create the offering `default` with monthly and yearly packages, and design the paywall in the Paywalls
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
- [ ] Verify: `GET /app/config` returns 200; `POST /revenuecat/webhook` without auth returns 401; RevenueCat's
      "Send test event" returns 200.

## 5. Build and TestFlight

```bash
cd Mobile
npx eas-cli@latest login
npx eas-cli@latest init                 # links the EAS project, writes extra.eas.projectId into app.json
npx eas-cli@latest build -p ios --profile production
npx eas-cli@latest submit -p ios --latest
```

- [ ] EAS creates the distribution certificate and provisioning profile on the first build (sign in with your Apple ID when prompted).
- [ ] TestFlight: add yourself and a few CofC students as internal testers.
- [ ] **Sandbox purchase test**: buy monthly in the TestFlight build with a Sandbox Apple ID → Settings shows
      "ClassMate Pro · Billed through the App Store", and `/me/subscription` returns `billing_source: "app_store"`.
      Then test Restore purchases on a second device, and cancel (Pro should last until expiry).

## 6. App Store listing

- [ ] Screenshots: 6.9" (1320×2868) is required. Take them from the Simulator (iPhone 17 Pro Max) with real-looking data.
- [ ] Description must include links to the **Terms of Use (EULA)** and **Privacy Policy** (required for subscriptions).
- [ ] Support URL and privacy policy URL (`https://www.tryclassmate.com/privacy`).
- [ ] App Privacy labels: Contact info (email, name), User content (course materials, notes, chat), Identifiers (user ID),
      Purchases. All linked to the user, none used for tracking.
- [ ] Age rating questionnaire (expected 4+).
- [ ] **Review notes and a demo account** on production with seeded courses and deadlines (reviewers can't upload a syllabus).

## 7. Review risks (known)

- **4.2 Minimum functionality**: The app is native (tabs, calendar, chat, haptics) but read-mostly; adding courses
  and syllabi happens on the web. Adding deadline reminders (local notifications) and syllabus upload before
  submission would make this much safer. See "Next" below.
- **3.1.1 / 3.1.3**: The "More on the web" links open tryclassmate.com pages that show Stripe upgrade buttons.
  On the US storefront, linking out is allowed. To be conservative, either hide upgrade CTAs on the web when
  opened from the app (e.g. `?from=ios`) or drop those links for the review build.
- 5.1.1(v) account deletion: covered (Settings → Delete account).
- 4.8 Sign in with Apple: not required (email/password only, no third-party login).

## Next (not built yet)

1. Local deadline reminders with `expo-notifications` (no server or APNs work needed for local ones).
2. Upload a syllabus from the phone (`expo-document-picker` → `POST /courses/{id}/syllabus`) and add a course.
3. Replace the placeholder App Store URL in the force-update screen (`src/app/_layout.tsx`) once the listing exists.
4. Push notifications (server-sent) and Android.

## Local development

```bash
# backend on a scratch DB (never point the seed script at production; it refuses to)
cd Backend && DATABASE_URL=sqlite:///./mobile-dev.db JWT_SECRET=dev OPENAI_API_KEY=... venv_fresh/bin/python -m uvicorn main:app --port 8000
cd Mobile && python3 scripts/seed-local.py && npx expo start --go --ios
```

Expo Go runs RevenueCat in preview mode. Real purchases need a development or TestFlight build.
