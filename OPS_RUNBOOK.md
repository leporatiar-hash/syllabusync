# classmate runbook: what breaks and who fixes it

classmate runs as a low-touch experiment after the January 2027 App Store launch. Alexander's time
budget: about 1 hour a week. Claude watches, fixes routine problems, and escalates only money,
messages to students, and decisions.

## The rules
- **Claude may do without asking:** read logs and production data (read-only), run the weekly report,
  draft support replies, write and test fixes on a branch.
- **Claude asks first (one "yes" in chat):** deploying (any push to main), sending any email or push to
  students, writing to the production database, changing App Store Connect, anything that costs money.
- **Only Alexander:** refunds outside Apple, legal and business decisions, Apple account and agreement
  renewals, passwords and sign-ins.

## How we notice problems
| Signal | Where | Cadence |
|---|---|---|
| Daily health check (backend up, website up, sync ran, reminders sent, errors, inbox) | `classmate-daily-voicemail` scheduled task | Daily 9am; only speaks up when something's wrong |
| Weekly one-screen report | `Backend/scripts/weekly_report.py` | Mondays |
| Students emailing | hello@tryclassmate.com (Resend inbox) | Checked in the daily run |
| Crashes | Sentry, Railway logs | Daily run |

## What breaks, how to tell, who fixes it
| Problem | How it shows up | Fix | Who |
|---|---|---|---|
| A student's LMS connection dies (password change, token revoked) | Report: "N connections stopped syncing" | iPhone users get an automatic "tap to reconnect" push. Web-only users: draft an email | Automatic; email needs a yes |
| A sync crashes on our side | Report: "hit a classmate bug during sync" with the error; Railway log has the traceback | Reproduce in a test, fix, deploy | Claude; deploy needs a yes |
| Connections "healthy" but not syncing (12h+) | Report: stale connections | Check the sync loop in the Railway logs; redeploy restarts it | Claude; redeploy needs a yes |
| No reminders going out | Report: reminders sent = 0 while students are reachable | Check the push loop, Expo push errors, APNs key | Claude |
| Wrong dates (timezone, LMS format change at a school) | Student email; unusual times in the data (e.g. 12:59 AM) | Fix sync, add a test from the real case | Claude; deploy needs a yes |
| A school's LMS isn't detected | Student email; `lms_connect_step` events stall at "detected" | Add the school/host in `schools.py`, test, deploy | Claude; deploy needs a yes |
| Backend down / deploy failed | Daily check; Railway shows FAILED | Roll back to the last good deploy in Railway | Claude proposes; Alexander or Claude with a yes |
| A dependency breaks a build | Railway build fails | Dependencies are pinned in `requirements.txt`; never unpin | Claude |
| AI costs spike | Report AI spend; site-wide cap $5/day pauses AI features (calendar and reminders keep working) | Look for abuse; adjust `AI_GLOBAL_DAILY_USD` | Alexander decides |
| Apple build upload blocked | EAS submit fails: "agreement missing or expired" | Accept the agreement in App Store Connect › Business | Alexander (2 min) |
| Apple review rejection or question | App Store Connect / email | Claude drafts the reply and the fix | Alexander approves |
| Refund request | Email | iPhone: point to reportaproblem.apple.com. Web: 14-day no-questions refund in Stripe | Alexander approves web refunds |
| Student asks to delete their data | Email | In-app Settings › Delete account; or Claude runs the delete with a yes | Claude with a yes |
| Security issue or possible data leak | Anything unusual | Stop and tell Alexander immediately | Escalate |

## Yearly / occasional (Alexander)
- Apple Developer Program renewal ($99, renews Oct 17)
- New Apple agreements when Apple updates them (they block uploads until accepted)
- iOS major update each September: Claude rebuilds and tests; Alexander approves the release
- Domain renewal (tryclassmate.com at Porkbun)

## Kill switch / wind-down
If the experiment ends: stop new signups, keep reminders running until the semester ends, email
students 30 days ahead (with a yes), export their data on request, then delete accounts and data.
