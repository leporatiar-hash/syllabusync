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
