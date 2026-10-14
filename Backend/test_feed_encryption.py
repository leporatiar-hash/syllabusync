#!/usr/bin/env python3
"""
Calendar-feed links (they work like passwords) are encrypted at rest.

No pytest in this project -- run directly: `python3 test_feed_encryption.py`. Throwaway SQLite DB,
a generated ENCRYPTION_KEY, and a fake httpx client (no network).

Covers: connect stores an encrypted value; sync reads it; reconnecting the same link is still
detected as a duplicate; old plain-text rows are encrypted by the startup pass; an unreadable
value (key changed) is logged as our problem and never marks the student's link broken.
"""
import os
import tempfile
import uuid

from cryptography.fernet import Fernet

_DB_FD, _DB_PATH = tempfile.mkstemp(suffix=".db")
os.close(_DB_FD)
os.environ["OPENAI_API_KEY"] = "sk-test"
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_PATH}"
os.environ["JWT_SECRET"] = "test-jwt-secret-for-feeds"
os.environ["ENCRYPTION_KEY"] = Fernet.generate_key().decode()

from starlette.testclient import TestClient  # noqa: E402

import main  # noqa: E402

FEED = "https://lms.example.edu/d2l/le/calendar/feed/user/feed.ics?token=SECRET123"
SEEN = []
ICS = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:1@x\r\nSUMMARY:HW 1 - Due\r\nDTSTART:20261120T045900Z\r\nLOCATION:2026 Fall Investments (FINC-400-02)\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n"


class _Resp:
    status_code = 200
    text = ICS


class _Client:
    def __init__(self, *a, **k):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *e):
        return False

    def get(self, url, **k):
        SEEN.append(url)
        return _Resp()


main.httpx.Client = _Client
client = TestClient(main.app)


def _user():
    ip = f"198.22.{uuid.uuid4().int % 250}.{uuid.uuid4().int % 250 + 1}"
    r = client.post("/auth/register", json={"email": f"f-{uuid.uuid4().hex[:8]}@example.edu", "password": "password123"}, headers={"X-Real-IP": ip})
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    return client.get("/me", headers=h).json()["user_id"], h


def _stored(uid):
    db = main.SessionLocal()
    try:
        return [c.ical_url for c in db.query(main.LMSConnection).filter_by(user_id=uid).all()]
    finally:
        db.close()


def test_connect_encrypts_and_sync_reads():
    uid, h = _user()
    SEEN.clear()
    r = client.post("/lms/connect/ical", json={"ical_url": FEED}, headers=h)
    assert r.status_code == 200 and r.json()["initial_sync"]["synced_count"] == 1, r.text
    stored = _stored(uid)[0]
    assert stored.startswith("enc:") and "SECRET123" not in stored, stored
    assert SEEN[-1] == FEED, "sync must fetch the real (decrypted) link"
    assert "already connected" in client.post("/lms/connect/ical", json={"ical_url": FEED}, headers=h).json()["detail"]


def test_startup_pass_encrypts_old_rows():
    uid, _ = _user()
    db = main.SessionLocal()
    try:
        db.add(main.LMSConnection(user_id=uid, provider="ical", ical_url=FEED))
        db.commit()
    finally:
        db.close()
    main.encrypt_existing_feed_urls()
    main.encrypt_existing_feed_urls()  # idempotent: no double encryption
    stored = _stored(uid)[0]
    assert stored.startswith("enc:") and main._open_feed(stored) == FEED, stored


def test_unreadable_feed_is_not_the_students_fault():
    uid, h = _user()
    db = main.SessionLocal()
    try:
        db.add(main.LMSConnection(user_id=uid, provider="ical", ical_url="enc:not-a-real-token"))
        db.commit()
        conn = db.query(main.LMSConnection).filter_by(user_id=uid).first()
        for _ in range(3):
            main.sync_ical(conn, uid, db)
    finally:
        db.close()
    assert [c["status"] for c in client.get("/lms/connections", headers=h).json()] == ["ok"]


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
