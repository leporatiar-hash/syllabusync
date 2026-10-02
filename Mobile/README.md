# ClassMate iOS app

Expo (SDK 57) + Expo Router app for ClassMate. Talks to the same FastAPI backend as the web app.

- Screens: login/signup/reset, Home (overdue/today/next 7 days), Calendar (month grid), Courses + course detail,
  Chat (streams `/chat/conversations/{id}/messages` over SSE via `expo/fetch`), Settings (plan, IAP, delete account).
- Auth: native JWT from `/auth/login`, stored in the Keychain (`expo-secure-store`), auto-refresh on 401 (`src/lib/api.ts`).
- Payments: RevenueCat (`src/lib/purchases.ts`). App user id = our user id; the backend learns about purchases from
  `POST /revenuecat/webhook`. Upgrade UI is hidden until `EXPO_PUBLIC_REVENUECAT_IOS_KEY` is set.
- Version gate: on launch the app reads `GET /app/config` and blocks builds older than `min_supported_version`.

See **LAUNCH_CHECKLIST.md** for App Store / RevenueCat / TestFlight steps and local dev setup.

```bash
npx tsc --noEmit && npx expo lint   # before committing
```
