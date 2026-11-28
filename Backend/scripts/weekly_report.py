"""classmate weekly report: one screen, read-only.

Run: railway run -s Postgres -- Backend/venv_fresh/bin/python Backend/scripts/weekly_report.py [--days 7]
Prints markdown. Opens the database read-only, so it can never change anything.

What it answers, in order: are students getting reminded (the product), are they arriving and
setting up (growth), is anyone paying (income), and is anything broken (what needs attention).
"""
import os
import sys
from datetime import datetime, timedelta

import psycopg2

days = int(sys.argv[sys.argv.index("--days") + 1]) if "--days" in sys.argv else 7
conn = psycopg2.connect(os.environ.get("DATABASE_PUBLIC_URL") or os.environ["DATABASE_URL"])
conn.set_session(readonly=True)
cur = conn.cursor()


def one(sql, *args):
    cur.execute(sql, args)
    return cur.fetchone()[0] or 0


def rows(sql, *args):
    cur.execute(sql, args)
    return cur.fetchall()


since = datetime.utcnow() - timedelta(days=days)
before = since - timedelta(days=days)
today = datetime.utcnow().strftime("%Y-%m-%d")
in14 = (datetime.utcnow() + timedelta(days=14)).strftime("%Y-%m-%d")


def delta(now, prev):
    d = now - prev
    return f"{now} ({'+' if d >= 0 else ''}{d} vs prior {days}d)"


# Reminders: the product
reminders = one("select count(*) from push_notifications_sent where sent_at >= %s and kind in ('day_before','three_days','exam_week','change','weekly')", since)
reminders_prev = one("select count(*) from push_notifications_sent where sent_at >= %s and sent_at < %s and kind in ('day_before','three_days','exam_week','change','weekly')", before, since)
reachable = one("select count(distinct user_id) from push_tokens")
with_upcoming = one("select count(distinct user_id) from deadlines where date >= %s and date <= %s and coalesce(completed,false)=false", today, in14)
reach_upcoming = one("""select count(distinct d.user_id) from deadlines d join push_tokens p on p.user_id = d.user_id
                        where d.date >= %s and d.date <= %s and coalesce(d.completed,false)=false""", today, in14)

# Growth and setup
signups = one("select count(*) from users where created_at >= %s", since)
signups_prev = one("select count(*) from users where created_at >= %s and created_at < %s", before, since)
new_devices = one("select count(distinct user_id) from push_tokens where created_at >= %s", since)
new_lms = one("select count(*) from lms_connections where created_at >= %s", since)
total_users = one("select count(*) from users")

# Money
iap_active = one("select count(*) from user_profiles where iap_expires_at > now()")
iap_trial = one("select count(*) from user_profiles where iap_expires_at > now() and lower(coalesce(iap_period_type,'')) = 'trial'")
stripe_active = one("select count(*) from user_profiles where subscription_tier = 'pro' and subscription_status in ('active','trialing')")

# Health
broken = rows("""select provider, count(*) from lms_connections where coalesce(failure_count,0) >= 2 group by provider""")
stale = one("select count(*) from lms_connections where coalesce(failure_count,0) < 2 and (last_synced is null or last_synced < now() - interval '12 hours')")
ai_spend = one("select coalesce(sum(cost_microusd),0) from ai_usage where day >= %s", since.strftime("%Y-%m-%d")) / 1e6

print(f"# classmate: last {days} days (to {datetime.utcnow():%b %d})\n")
print("## Reminders (the product)")
print(f"- Reminders sent: **{delta(reminders, reminders_prev)}**")
print(f"- Students who can get reminders (have the app + notifications): **{reachable}**")
print(f"- Students with something due in the next 14 days: {with_upcoming}, of whom reachable: **{reach_upcoming}**")
print("\n## Growth and setup")
print(f"- New signups: **{delta(signups, signups_prev)}** (total {total_users})")
print(f"- New iPhone installs with notifications on: {new_devices}")
print(f"- New LMS connections: {new_lms}")
print("\n## Money")
print(f"- Paying via App Store: **{iap_active - iap_trial}**, in free trial: {iap_trial}")
print(f"- Paying via website (Stripe): {stripe_active}")
print(f"- AI spend: ${ai_spend:.2f}")
print("\n## Needs attention")
problems = []
for provider, n in broken:
    problems.append(f"{n} {provider} connection(s) stopped syncing (iPhone users get a reconnect push; web-only users aren't told)")
if stale:
    problems.append(f"{stale} connection(s) look healthy but haven't synced in 12+ hours: check the sync job")
for err, n in rows("""select left(last_error, 90), count(*) from lms_connections
                      where last_error like 'internal:%%' and coalesce(failure_count,0) < 2 group by 1"""):
    problems.append(f"{n} connection(s) hit a classmate bug during sync: {err}")
if reachable and reminders == 0:
    problems.append("No reminders went out although students can receive them: check the push job")
print("\n".join(f"- {p}" for p in problems) if problems else "- Nothing. 🎉")
