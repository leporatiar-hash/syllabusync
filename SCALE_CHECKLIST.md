# ClassMate — User-Scale Checklist

_Generated from live Supabase + backend DB state on 2026-02-04.
Numbers in brackets are current snapshot values._

---

## 1. Auth & Onboarding

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1.1 | All signups confirm email before accessing the app | ✅ Done | 7 / 7 Supabase users are `email_confirmed` |
| 1.2 | Onboarding screen captures school, year, major | ⚠️ Partial | 3 of 7 users have full metadata in Supabase `user_metadata`; 4 have none — they either skipped or the save failed silently |
| 1.3 | Onboarding data is persisted to backend `user_profiles` table | 🔴 Broken | Only 1 `user_profiles` row exists [1]. `mccammono1` and `joeleporati53` filled out onboarding (metadata is in Supabase) but no backend row was created. The `POST /me` (or equivalent) endpoint is either not being called or erroring out quietly |
| 1.4 | First-time users land on onboarding; returning users skip it | ❓ Verify | No way to confirm from DB alone — needs a live walkthrough with a fresh account |
| 1.5 | `leporati@g.cofc.edu` (Jan 31, never returned) — determine if abandoned or duplicate | ❓ Verify | Looks like an early test account. Confirm it's safe to ignore |

---

## 2. Course & Data Ownership (`user_id` integrity)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 2.1 | Every course row has a real Supabase UUID as `user_id` | 🔴 Broken | 6 courses have `user_id = "default"`, 6 have `"legacy"` [12 total]. None use the actual Supabase `sub` claim |
| 2.2 | Every deadline row has a real Supabase UUID as `user_id` | 🔴 Broken | All 82 deadlines are owned by `"default"` |
| 2.3 | `get_current_user` extracts `sub` from the JWT and uses it for all queries | ✅ Code is correct | `_get_current_user` pulls `claims["sub"]` — the mismatch is in the *data*, not the code |
| 2.4 | Migration plan: re-key `"default"` rows to `leporatiar`'s real UUID (`26642736-…`) | 🔲 TODO | One-time SQL UPDATE on courses, deadlines, flashcard_sets, flashcards, quizzes, quiz_questions, summaries, calendar_entries |
| 2.5 | Delete 6 `"legacy"` duplicate `finance / 313` courses (empty shells, no data) | 🔲 TODO | Safe to hard-delete; they have zero deadlines, zero flashcards |

---

## 3. Duplicate-Course Prevention

| # | Item | Status | Notes |
|---|------|--------|-------|
| 3.1 | "Create course" button is disabled while the POST is in-flight | ❓ Verify | `CoursesClient` sets `creating = true` and the button has `disabled={creating}` — looks correct in code. The 6 duplicates suggest it wasn't working at the time they were created, or the user clicked before the state updated |
| 3.2 | Backend rejects duplicate `(name, code, semester)` for the same user | 🔲 TODO | No unique constraint exists. Add a check in `POST /courses` or a DB unique index on `(user_id, code, semester)` |

---

## 4. Deadline & Calendar Flow

| # | Item | Status | Notes |
|---|------|--------|-------|
| 4.1 | Syllabus upload extracts deadlines correctly | ✅ Working | 82 deadlines extracted from `Finance 315` syllabus |
| 4.2 | "Save to Calendar" persists and shows on `/calendar` | ✅ Working | 60 / 82 deadlines are in `calendar_entries` |
| 4.3 | Deadline completion checkbox persists | 🔴 0 completions | Either no one has used it yet, or it's not working. Needs a live tap-test |
| 4.4 | Class schedule "Save" persists to `course_info.logistics.meeting_times` | ✅ Fixed | Time parsing + PATCH both working after the Feb 4 fix |
| 4.5 | "Add to Calendar" for class sessions creates `type=Class` deadlines | ✅ Built | Creates entries for next 4 weeks, auto-saves to calendar |

---

## 5. Study Tools

| # | Item | Status | Notes |
|---|------|--------|-------|
| 5.1 | Flashcard generation works end-to-end | ✅ Working | 4 sets, 70 cards — all from `Finance 315` |
| 5.2 | Quiz generation works end-to-end | ✅ Working | 1 quiz exists |
| 5.3 | Summary generation works end-to-end | 🔴 Zero output | `summaries` table is empty [0]. The upload UI supports it and the endpoint exists — needs a test upload to confirm it's not silently failing |
| 5.4 | Flashcard Studio flow: pick deck → land directly in study mode | ✅ Fixed | Auto-scrolls to review section on deck select |

---

## 6. New-User Experience (the 4 users who signed up Feb 4)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 6.1 | `andresenh@g.cofc.edu` | 🔴 Stalled | Confirmed email, logged in once, no onboarding metadata, no backend profile, no activity |
| 6.2 | `lyonsbh@g.cofc.edu` | 🔴 Stalled | Same pattern as 6.1 |
| 6.3 | `mccammonop@g.cofc.edu` | 🔴 Stalled | Same pattern as 6.1 |
| 6.4 | `mccammono1@g.cofc.edu` | ⚠️ Partial | Onboarding metadata saved to Supabase but no backend `user_profiles` row and no courses/deadlines. Last login Feb 4 — still active |
| 6.5 | Root cause: identify where the new-user flow breaks after email confirmation | 🔲 TODO | Likely: onboarding page saves to Supabase `user_metadata` but never POSTs to `/me` to create the backend profile, OR the redirect after onboarding goes to a page that errors because there's no backend profile yet |

---

## 7. Mobile & UI Polish

| # | Item | Status | Notes |
|---|------|--------|-------|
| 7.1 | Calendar month view readable on mobile | ✅ Fixed | Dense pill badges, correct +N overflow, compact cells |
| 7.2 | Calendar week view readable on mobile | ✅ Fixed | Tighter cells, pill badges, correct overflow |
| 7.3 | Flashcard Studio mobile flow | ✅ Fixed | Browse vs Study tabs, auto-scroll |
| 7.4 | Course Info tab — class schedule grid | ✅ Built | Mon–Fri visual grid with gradient blocks |

---

## 8. Backend Hygiene

| # | Item | Status | Notes |
|---|------|--------|-------|
| 8.1 | Remove `print` / `[DEBUG]` statements from production endpoints | 🔲 TODO | `GET /deadlines` has `print(f"[DEBUG] …")` on line 1372 |
| 8.2 | Remove `console.error` calls that leak stack traces to the client | ✅ Cleaned | `CoursesClient` debug lines removed |
| 8.3 | `.env` contains live OpenAI key and Supabase service key | ⚠️ Note | Fine for Railway (injected at runtime), but the local `.env` file should stay in `.gitignore` — confirm it's not tracked |

---

## Priority Order (what to do next)

1. **🔴 Re-key `user_id`** — the `"default"` / `"legacy"` rows will cause every new user's queries to return empty. One SQL script fixes everything.
2. **🔴 Fix onboarding → backend profile creation** — 4 of 7 users are stuck here. Find and fix the missing `POST /me` call (or equivalent) in the onboarding page.
3. **🔴 Test summary generation** — zero output is either a silent failure or an untested path.
4. **🔲 Add duplicate-course guard** on the backend.
5. **🔲 Clean the `[DEBUG]` print in `GET /deadlines`.**
6. **❓ Live-test deadline completion checkbox** to confirm it actually persists.
