#!/usr/bin/env python3
"""
Tests for mobile push reminders: token registration, preferences, and the reminder pass.

No pytest in this project -- run directly: `python3 test_push.py`. Uses a throwaway SQLite DB,
a frozen clock, and a fake Expo sender (nothing leaves the machine).

Covers:
  - POST/DELETE /me/push-token (validation, re-registration moves a device to the new account)
  - GET/PUT /me/notification-settings (defaults on)
  - day_before + three_days for every deadline; exam_week 7 days out for exams only
  - multiple deadlines on one day are grouped into one notification
  - the ledger: a second pass sends nothing; a deadline added later still gets its reminder
  - nothing is sent outside the user's local 6-10pm window (timezone aware)
  - completed and recurring deadlines are skipped; preferences turn kinds off
  - Sunday weekly brief, once per ISO week
  - DeviceNotRegistered tickets delete the token; failed sends are not recorded (retry next pass)
  - delete-account removes tokens
  - setup nudges: "connect your LMS" a day after signup and again at day 4 (then never);
    once connected, one "add your syllabi" listing courses without one
  - free tier gets only the day-before reminder; Pro adds 3-day, exam week, Sunday plan, changes
  - change alerts: a moved due date or new LMS item is announced once; several are grouped
"""
import os
import tempfile
import uuid
from datetime import datetime, timedelta

_DB_FD, _DB_PATH = tempfile.mkstemp(suffix=".db")
os.close(_DB_FD)
os.environ["OPENAI_API_KEY"] = "sk-test"
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_PATH}"
os.environ["JWT_SECRET"] = "test-jwt-secret-for-push"
os.environ.pop("RESEND_API_KEY", None)
# Most tests exercise the full Pro reminder set; test_free_tier_* turns the promo off.
os.environ["PROMO_PRO_UNTIL"] = "2099-12-31"

from starlette.testclient import TestClient  # noqa: E402

import main  # noqa: E402

client = TestClient(main.app)

# Sunday 2026-10-04 23:00 UTC == 19:00 in New York (EDT)
SUNDAY_7PM_NY = datetime(2026, 10, 4, 23, 0)
TODAY = SUNDAY_7PM_NY.date() - timedelta(days=0)  # local date in NY is also 10/04

SENT: list[dict] = []
NEXT_TICKETS: list[dict] | None = None


def fake_send(messages):
    global NEXT_TICKETS
    SENT.extend(messages)
    if NEXT_TICKETS is not None:
        t, NEXT_TICKETS = NEXT_TICKETS, None
        return t
    return [{"status": "ok", "id": uuid.uuid4().hex} for _ in messages]


main._expo_push_send = fake_send


def _user(tz="America/New_York"):
    email = f"push-{uuid.uuid4().hex[:8]}@example.edu"
    ip = f"198.18.{uuid.uuid4().int % 250}.{uuid.uuid4().int % 250 + 1}"
    r = client.post("/auth/register", json={"email": email, "password": "password123"}, headers={"X-Real-IP": ip})
    assert r.status_code == 200, r.text
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    token = f"ExponentPushToken[{uuid.uuid4().hex[:22]}]"
    r = client.post("/me/push-token", json={"token": token, "platform": "ios", "timezone": tz}, headers=h)
    assert r.status_code == 200, r.text
    uid = client.get("/me", headers=h).json()["user_id"]
    return uid, h, token


def _course(h, name="Principles of Finance", code="FINC 303"):
    return client.post("/courses", json={"name": name, "code": code}, headers=h).json()["id"]


def _deadline(h, days, title, typ="Assignment", course_id=None, time="23:59"):
    r = client.post("/deadlines", json={"title": title, "date": (TODAY + timedelta(days=days)).isoformat(),
                                        "type": typ, "time": time, "course_id": course_id}, headers=h)
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _mine(token):
    return [m for m in SENT if m["to"] == token]


def _run(now=SUNDAY_7PM_NY):
    return main._run_push_reminders(now_utc=now)


def test_token_validation_and_settings():
    uid, h, token = _user()
    assert client.post("/me/push-token", json={"token": "garbage"}, headers=h).status_code == 400
    assert client.get("/me/notification-settings", headers=h).json() == {"deadlines": True, "exams": True, "weekly": True}
    r = client.put("/me/notification-settings", json={"deadlines": True, "exams": False, "weekly": False}, headers=h)
    assert r.json() == {"deadlines": True, "exams": False, "weekly": False}
    # Same device signs into another account: token moves
    uid2, h2, _ = _user()
    client.post("/me/push-token", json={"token": token, "timezone": "America/New_York"}, headers=h2)
    db = main.SessionLocal()
    try:
        assert db.query(main.PushToken).filter(main.PushToken.token == token).one().user_id == uid2
    finally:
        db.close()
    assert client.request("DELETE", "/me/push-token", json={"token": token}, headers=h2).json() == {"registered": False}


def test_reminder_kinds_grouping_and_ledger():
    uid, h, token = _user()
    client.put("/me/notification-settings", json={"deadlines": True, "exams": True, "weekly": False}, headers=h)
    c = _course(h)
    _deadline(h, 1, "Problem Set 4", course_id=c)
    _deadline(h, 1, "Reading quiz", "Quiz", course_id=c, time=None)
    _deadline(h, 3, "Case write-up", course_id=c)
    _deadline(h, 7, "Midterm Exam", "Exam", course_id=c, time="09:25")
    _deadline(h, 7, "Lab report", course_id=c)      # not an exam: no week-out alert
    _deadline(h, 2, "Nothing today", course_id=c)  # 2 days out: no reminder kind
    _run()
    msgs = {m["title"]: m for m in _mine(token)}
    assert "2 deadlines due tomorrow" in msgs, list(msgs)
    assert "Problem Set 4 (FINC 303)" in msgs["2 deadlines due tomorrow"]["body"]
    assert "Due in 3 days: Case write-up" in msgs and msgs["Due in 3 days: Case write-up"]["body"] == "FINC 303 · 11:59 PM"
    assert "Midterm Exam is a week away" in msgs
    assert len(_mine(token)) == 3, [m["title"] for m in _mine(token)]

    before = len(SENT)
    _run(SUNDAY_7PM_NY + timedelta(minutes=15))
    assert len(SENT) == before, "ledger must prevent duplicates"

    _deadline(h, 1, "Late-added memo", course_id=c)
    _run(SUNDAY_7PM_NY + timedelta(minutes=30))
    new = _mine(token)[3:]
    assert [m["title"] for m in new] == ["Due tomorrow: Late-added memo"], [m["title"] for m in new]


def test_send_window_is_local_time():
    uid, h, token = _user(tz="America/Los_Angeles")  # 23:00 UTC = 16:00 PDT
    client.put("/me/notification-settings", json={"deadlines": True, "exams": True, "weekly": False}, headers=h)
    # LA local date is still 10/04, so "tomorrow" is 10/05 for them too
    _deadline(h, 1, "LA assignment")
    _run()
    assert _mine(token) == []
    _run(SUNDAY_7PM_NY + timedelta(hours=2))  # 18:00 PDT
    assert [m["title"] for m in _mine(token)] == ["Due tomorrow: LA assignment"]
    # 1am NY Monday is outside the window
    uid2, h2, token2 = _user()
    _deadline(h2, 2, "x")
    _run(datetime(2026, 10, 5, 5, 0))
    assert _mine(token2) == []


def test_skips_completed_recurring_and_disabled():
    uid, h, token = _user()
    client.put("/me/notification-settings", json={"deadlines": True, "exams": True, "weekly": False}, headers=h)
    done = _deadline(h, 1, "Already done")
    client.patch(f"/deadlines/{done}/complete", headers=h)
    rec = _deadline(h, 3, "Lecture")
    db = main.SessionLocal()
    try:
        db.query(main.Deadline).filter(main.Deadline.id == rec).update({"recurring": True})
        db.commit()
    finally:
        db.close()
    _run()
    assert _mine(token) == []

    uid2, h2, token2 = _user()
    client.put("/me/notification-settings", json={"deadlines": False, "exams": False, "weekly": False}, headers=h2)
    _deadline(h2, 1, "Muted")
    _deadline(h2, 7, "Final Exam", "Exam")
    _run()
    assert _mine(token2) == []


def test_weekly_brief_once_per_week():
    uid, h, token = _user()
    client.put("/me/notification-settings", json={"deadlines": False, "exams": False, "weekly": True}, headers=h)
    _deadline(h, 2, "A")
    _deadline(h, 2, "B")
    _deadline(h, 5, "Final Exam", "Exam")
    _deadline(h, 0, "Due today (not in 'week ahead')")
    _run()
    weekly = _mine(token)
    assert len(weekly) == 1 and weekly[0]["title"] == "Your week: 3 deadlines", weekly
    assert weekly[0]["body"] == "Includes 1 exam. Busiest day: Tuesday.", weekly[0]["body"]
    _run(SUNDAY_7PM_NY + timedelta(hours=1))
    assert len(_mine(token)) == 1
    # Monday: not a Sunday, no brief
    _run(SUNDAY_7PM_NY + timedelta(days=1))
    assert len(_mine(token)) == 1


def test_failed_and_unregistered_tokens():
    global NEXT_TICKETS
    uid, h, token = _user()
    client.put("/me/notification-settings", json={"deadlines": True, "exams": False, "weekly": False}, headers=h)
    _deadline(h, 1, "Retry me")
    NEXT_TICKETS = [{"status": "error", "message": "boom"}]
    _run()
    assert len(_mine(token)) == 1
    _run(SUNDAY_7PM_NY + timedelta(minutes=15))  # not recorded, so it retries
    assert len(_mine(token)) == 2

    uid2, h2, token2 = _user()
    _deadline(h2, 1, "Gone")
    NEXT_TICKETS = [{"status": "error", "details": {"error": "DeviceNotRegistered"}}]
    _run()
    db = main.SessionLocal()
    try:
        assert db.query(main.PushToken).filter(main.PushToken.token == token2).first() is None
    finally:
        db.close()


def test_delete_account_removes_tokens():
    uid, h, token = _user()
    assert client.delete("/auth/delete-account", headers=h).status_code == 200
    db = main.SessionLocal()
    try:
        assert db.query(main.PushToken).filter(main.PushToken.user_id == uid).count() == 0
    finally:
        db.close()


def _age(uid, days):
    db = main.SessionLocal()
    try:
        db.query(main.User).filter(main.User.id == uid).update({"created_at": datetime.utcnow() - timedelta(days=days)})
        db.commit()
    finally:
        db.close()


def test_setup_nudges():
    uid, h, token = _user()
    client.put("/me/notification-settings", json={"deadlines": True, "exams": False, "weekly": False}, headers=h)
    _run()
    assert _mine(token) == [], "no nudge on signup day"
    _age(uid, 1)
    _run()
    assert [m["data"]["screen"] for m in _mine(token)] == ["connect"], _mine(token)
    _run(SUNDAY_7PM_NY + timedelta(minutes=15))
    assert len(_mine(token)) == 1, "connect nudge once"
    _age(uid, 4)
    _run(SUNDAY_7PM_NY + timedelta(minutes=30))
    assert len(_mine(token)) == 2, "second connect nudge at day 4"
    _age(uid, 9)
    _run(SUNDAY_7PM_NY + timedelta(minutes=45))
    assert len(_mine(token)) == 2, "never a third"

    # Connected: once a day has passed, one nudge for the courses without a syllabus
    db = main.SessionLocal()
    try:
        db.add(main.LMSConnection(user_id=uid, provider="ical", ical_url="https://x.edu/f.ics",
                                  created_at=datetime.utcnow() - timedelta(days=2)))
        db.add(main.Course(user_id=uid, name="Investments", code="FINC 400"))
        db.add(main.Course(user_id=uid, name="Art", code="ARTH 103", syllabus_text="has one"))
        db.commit()
    finally:
        db.close()
    _run(SUNDAY_7PM_NY + timedelta(minutes=60))
    last = _mine(token)[-1]
    assert last["title"] == "Add your syllabi (1 to go)" and "FINC 400" in last["body"], last
    _run(SUNDAY_7PM_NY + timedelta(minutes=75))
    assert len(_mine(token)) == 3, "syllabus nudge once"

    # A feed that stopped working: one "reconnect" nudge per failing episode
    db = main.SessionLocal()
    try:
        conn = db.query(main.LMSConnection).filter_by(user_id=uid).first()
        conn.failure_count = 2
        conn.failing_since = datetime.utcnow()
        db.commit()
    finally:
        db.close()
    _run(SUNDAY_7PM_NY + timedelta(minutes=80))
    last = _mine(token)[-1]
    assert last["title"] == "Your LMS stopped syncing" and last["data"]["screen"] == "connect", last
    _run(SUNDAY_7PM_NY + timedelta(minutes=85))
    assert len(_mine(token)) == 4, "reconnect nudge once per episode"

    # Muted deadline reminders also mute setup nudges
    uid2, h2, token2 = _user()
    client.put("/me/notification-settings", json={"deadlines": False, "exams": False, "weekly": False}, headers=h2)
    _age(uid2, 2)
    _run(SUNDAY_7PM_NY + timedelta(minutes=90))
    assert _mine(token2) == []


def test_free_tier_gets_day_before_only():
    uid, h, token = _user()
    client.put("/me/notification-settings", json={"deadlines": True, "exams": True, "weekly": True}, headers=h)
    _deadline(h, 1, "Tomorrow thing")
    _deadline(h, 3, "Three-day thing")
    _deadline(h, 7, "Big Exam", "Exam")
    os.environ.pop("PROMO_PRO_UNTIL", None)
    try:
        _run()
    finally:
        os.environ["PROMO_PRO_UNTIL"] = "2099-12-31"
    assert [m["title"] for m in _mine(token)] == ["Due tomorrow: Tomorrow thing"], [m["title"] for m in _mine(token)]


def _change(uid, deadline_id, kind, old_days=None):
    db = main.SessionLocal()
    try:
        d = db.query(main.Deadline).filter(main.Deadline.id == deadline_id).first()
        old = (TODAY + timedelta(days=old_days)).isoformat() if old_days is not None else None
        main._record_lms_changes(db, uid, [(kind, d, old)], TODAY.isoformat())
        db.commit()
    finally:
        db.close()


def test_change_alerts():
    uid, h, token = _user()
    client.put("/me/notification-settings", json={"deadlines": True, "exams": False, "weekly": False}, headers=h)
    c = _course(h)
    moved = _deadline(h, 5, "Essay 2", course_id=c, time="23:59")
    _change(uid, moved, "moved", old_days=2)
    _run()
    msgs = [m for m in _mine(token) if "Essay 2" in m["title"]]
    assert len(msgs) == 1 and msgs[0]["title"] == "Essay 2 moved to Fri", _mine(token)
    assert msgs[0]["body"] == "FINC 303: now due Fri, Oct 9, 11:59 PM (was Tue, Oct 6)", msgs[0]["body"]
    assert "interruptionLevel" not in msgs[0], "not due soon: a normal notification"
    before = len(_mine(token))
    _run(SUNDAY_7PM_NY + timedelta(minutes=15))
    assert len(_mine(token)) == before, "each change is announced once"

    a = _deadline(h, 4, "Quiz 4", course_id=c)
    b = _deadline(h, 6, "Lab 3", course_id=c)
    _change(uid, a, "added")
    _change(uid, b, "moved", old_days=8)
    _change(uid, b, "moved", old_days=6)  # moved back where it was: not news
    _deadline(h, 60, "Far away")  # beyond the horizon: never recorded
    _run(SUNDAY_7PM_NY + timedelta(minutes=30))
    last = _mine(token)[-1]
    assert last["title"] == "New in FINC 303: Quiz 4" and last["body"] == "Due Thu, Oct 8, 11:59 PM. It's on your calendar.", last

    # Several real changes are grouped into one notification
    x = _deadline(h, 2, "Reading A", course_id=c)
    y = _deadline(h, 9, "Reading B", course_id=c)
    _change(uid, x, "moved", old_days=4)
    _change(uid, y, "added")
    _run(SUNDAY_7PM_NY + timedelta(minutes=45))
    last = _mine(token)[-1]
    assert last["title"] == "2 updates from your LMS" and last["body"] == "Reading A moved to Tue, Oct 6; Reading B added", last

    # Free users don't get change alerts
    uid2, h2, token2 = _user()
    z = _deadline(h2, 5, "Paper")
    _change(uid2, z, "moved", old_days=3)
    os.environ.pop("PROMO_PRO_UNTIL", None)
    try:
        _run(SUNDAY_7PM_NY + timedelta(minutes=50))
    finally:
        os.environ["PROMO_PRO_UNTIL"] = "2099-12-31"
    assert not any("changed" in m["title"] for m in _mine(token2))
    # Mute this user so their pending alert doesn't fire during later tests (which run as Pro)
    client.put("/me/notification-settings", json={"deadlines": False, "exams": False, "weekly": False}, headers=h2)


def test_change_alert_accuracy_guards():
    uid, h, token = _user()
    c = _course(h)
    a = _deadline(h, 5, "Real move", course_id=c)
    far = _deadline(h, 10, "Year fix", course_id=c)
    loose = _deadline(h, 4, "Boys Soccer")  # no course: not a class deadline
    db = main.SessionLocal()
    try:
        get = lambda i: db.query(main.Deadline).filter(main.Deadline.id == i).first()
        main._record_lms_changes(db, uid, [("moved", get(far), (main.date.fromisoformat(get(far).date) - main.timedelta(days=364)).isoformat()),
                                           ("added", get(loose), None)], TODAY.isoformat())
        db.commit()
        assert db.query(main.DeadlineChange).filter_by(user_id=uid).count() == 0, "year fixes and non-class events are ignored"
        many = [_deadline(h, 3 + i, f"Shifted {i}", course_id=c) for i in range(main.CHANGE_BULK_LIMIT + 1)]
        main._record_lms_changes(db, uid, [("moved", get(i), (main.date.fromisoformat(get(i).date) + main.timedelta(days=1)).isoformat()) for i in many],
                                 TODAY.isoformat())
        db.commit()
        assert db.query(main.DeadlineChange).filter_by(user_id=uid).count() == 0, "a mass shift is a data correction, not news"
        main._record_lms_changes(db, uid, [("moved", get(a), (TODAY + main.timedelta(days=2)).isoformat())], TODAY.isoformat())
        db.commit()
        assert db.query(main.DeadlineChange).filter_by(user_id=uid).count() == 1
    finally:
        db.close()
    client.put("/me/notification-settings", json={"deadlines": False, "exams": False, "weekly": False}, headers=h)


def test_urgent_change_goes_out_in_the_daytime():
    uid, h, token = _user()
    client.put("/me/notification-settings", json={"deadlines": True, "exams": False, "weekly": False}, headers=h)
    c = _course(h)
    soon = _deadline(h, 1, "Lab write-up", course_id=c, time="09:00")
    later = _deadline(h, 6, "Paper draft", course_id=c)
    _change(uid, soon, "moved", old_days=3)   # moved EARLIER, now due tomorrow
    _change(uid, later, "moved", old_days=8)
    sunday_10am_ny = SUNDAY_7PM_NY - timedelta(hours=9)
    _run(sunday_10am_ny)
    day = _mine(token)
    assert len(day) == 1 and day[0]["title"] == "Lab write-up is due sooner", day
    assert day[0]["body"] == "FINC 303: now due Mon, Oct 5, 9:00 AM (was Wed, Oct 7)", day[0]["body"]
    assert day[0]["interruptionLevel"] == "time-sensitive"
    _run(sunday_10am_ny + timedelta(minutes=15))
    assert len(_mine(token)) == 1, "no repeat"
    _run(SUNDAY_7PM_NY - timedelta(hours=12))  # 7am: quiet hours
    assert len(_mine(token)) == 1
    _run(SUNDAY_7PM_NY)  # evening: the non-urgent change (plus the regular reminders) go out
    evening = [m["title"] for m in _mine(token)[1:]]
    assert "Paper draft is due sooner" in evening and not any("Lab write-up is due sooner" == t for t in evening), evening
    client.put("/me/notification-settings", json={"deadlines": False, "exams": False, "weekly": False}, headers=h)


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    failed = 0
    for t in tests:
        try:
            t()
            print(f"PASS {t.__name__}")
        except Exception as e:
            failed += 1
            import traceback
            traceback.print_exc()
            print(f"FAIL {t.__name__}: {e!r}")
    os.unlink(_DB_PATH)
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    raise SystemExit(1 if failed else 0)
