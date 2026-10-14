#!/usr/bin/env python3
"""
Tests for what the chat AI sees and the daily briefing:
  - upcoming deadlines are always in context, even with hundreds of old incomplete ones
  - "today" is the student's date (phone timezone), shown with the weekday
  - every course's syllabus gets a share; a course named in the message is read first
  - one Daily Briefing per day: reopening chat returns today's instead of making another

No pytest in this project -- run directly: `python3 test_chat_context.py`. Throwaway SQLite DB;
OpenAI is stubbed.
"""
import os
import tempfile
import uuid
from datetime import datetime, timedelta
from types import SimpleNamespace
from zoneinfo import ZoneInfo

_DB_FD, _DB_PATH = tempfile.mkstemp(suffix=".db")
os.close(_DB_FD)
os.environ["OPENAI_API_KEY"] = "sk-test"
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_PATH}"
os.environ["JWT_SECRET"] = "test-jwt-secret-for-chat-context"

from starlette.testclient import TestClient  # noqa: E402

import main  # noqa: E402

client = TestClient(main.app)
CALLS = []


async def fake_create(**kw):
    CALLS.append(kw)
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="Essay 2 is due tomorrow."))])


main.client.chat.completions.create = fake_create


def _user():
    email = f"chat-{uuid.uuid4().hex[:8]}@example.edu"
    ip = f"198.23.{uuid.uuid4().int % 250}.{uuid.uuid4().int % 250 + 1}"
    r = client.post("/auth/register", json={"email": email, "password": "password123"}, headers={"X-Real-IP": ip})
    assert r.status_code == 200, r.text
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    return client.get("/me", headers=h).json()["user_id"], h


def _context(uid, message=None):
    db = main.SessionLocal()
    try:
        return main._build_chat_context(db, uid, message)
    finally:
        db.close()


def test_upcoming_deadlines_survive_a_long_past():
    uid, _ = _user()
    today = datetime.now(ZoneInfo(main.DEFAULT_USER_TZ)).date()
    db = main.SessionLocal()
    try:
        for i in range(300):  # an LMS feed full of old, never-checked-off items
            db.add(main.Deadline(user_id=uid, title=f"Old item {i}", date=(today - timedelta(days=30 + i)).isoformat()))
        db.add(main.Deadline(user_id=uid, title="Essay 2", date=(today + timedelta(days=1)).isoformat()))
        db.add(main.Deadline(user_id=uid, title="Last week quiz", date=(today - timedelta(days=3)).isoformat()))
        db.commit()
    finally:
        db.close()
    ctx = _context(uid)
    assert "Essay 2" in ctx and "[upcoming]" in ctx, "this week's work must be in context"
    assert "Last week quiz" in ctx, "recent past stays visible"
    assert "Old item 250" not in ctx, "months-old items are left out"
    assert f"today: {today.strftime('%A')}, {today.isoformat()}" in ctx


def test_every_syllabus_gets_a_share_and_named_course_first():
    uid, _ = _user()
    db = main.SessionLocal()
    try:
        for code, word in (("BIO 101", "photosynthesis"), ("CHEM 111", "stoichiometry"), ("ENGL 110", "LATEPOLICY")):
            db.add(main.Course(user_id=uid, name=f"{code} course", code=code, syllabus_text=(f"{word} " * 3000)))
        db.commit()
    finally:
        db.close()
    ctx = _context(uid, "what's the late policy in ENGL 110?")
    for code in ("BIO 101", "CHEM 111", "ENGL 110"):
        assert f"### {code} Syllabus" in ctx, code
    assert ctx.index("### ENGL 110 Syllabus") < ctx.index("### BIO 101 Syllabus"), "the course they asked about comes first"
    assert ctx.count("LATEPOLICY") > ctx.count("photosynthesis"), "the named course gets the bigger slice"


def test_one_daily_briefing_per_day():
    uid, h = _user()
    CALLS.clear()
    first = client.post("/chat/proactive-message", headers=h).json()
    second = client.post("/chat/proactive-message", headers=h).json()
    assert first["conversation_id"] == second["conversation_id"] and second.get("existing") is True, (first, second)
    assert len(CALLS) == 1, "the second open reuses today's briefing (no extra AI call)"
    assert CALLS[0]["model"] == main.CHAT_MODEL
    convs = client.get("/chat/conversations", headers=h).json()
    convs = convs.get("conversations", convs) if isinstance(convs, dict) else convs
    assert sum(1 for c in convs if c["title"].startswith("Daily Briefing")) == 1, convs


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    failed = 0
    for t in tests:
        try:
            t()
            print(f"PASS {t.__name__}")
        except Exception as e:  # noqa: BLE001
            failed += 1
            import traceback
            traceback.print_exc()
            print(f"FAIL {t.__name__}: {e!r}")
    os.unlink(_DB_PATH)
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    raise SystemExit(1 if failed else 0)
