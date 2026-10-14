#!/usr/bin/env python3
"""
Tests for the support inbox: Resend inbound webhook (signature check, save, dedupe, forward, sender
context) and the founder-only list/reply/status endpoints. Also checks the configurable sender.

No pytest in this project -- run directly: `python3 test_support_inbox.py`. Throwaway SQLite DB.
Resend calls are stubbed; nothing is sent.
"""
import base64
import hashlib
import hmac
import json
import os
import tempfile
import time
import uuid

_DB_FD, _DB_PATH = tempfile.mkstemp(suffix=".db")
os.close(_DB_FD)
os.environ["OPENAI_API_KEY"] = "sk-test"
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_PATH}"
os.environ["JWT_SECRET"] = "test-jwt-secret-for-inbox"
os.environ["RESEND_API_KEY"] = "re_test"
os.environ["EMAIL_FROM"] = "ClassMate <noreply@tryclassmate.com>"
os.environ["SUPPORT_FORWARD_TO"] = "founder@example.com"
_SECRET_BYTES = b"super-secret-signing-key"
os.environ["RESEND_WEBHOOK_SECRET"] = "whsec_" + base64.b64encode(_SECRET_BYTES).decode()

from starlette.testclient import TestClient  # noqa: E402

import main  # noqa: E402

client = TestClient(main.app)
SENT = []
main.resend.Emails.send = lambda params: SENT.append(params) or {"id": "sent"}
main._fetch_received_email = lambda email_id: {"text": f"Body of {email_id}", "message_id": f"<{email_id}@mail>"}


def _user(email=None):
    email = email or f"s-{uuid.uuid4().hex[:8]}@example.edu"
    ip = f"198.22.{uuid.uuid4().int % 250}.{uuid.uuid4().int % 250 + 1}"
    r = client.post("/auth/register", json={"email": email, "password": "password123"}, headers={"X-Real-IP": ip})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


FOUNDER = _user(next(iter(main.ADMIN_EMAILS)))


def _signed(event, secret=_SECRET_BYTES, ts=None):
    body = json.dumps(event).encode()
    msg_id, ts = f"msg_{uuid.uuid4().hex}", str(int(ts or time.time()))
    sig = base64.b64encode(hmac.new(secret, f"{msg_id}.{ts}.".encode() + body, hashlib.sha256).digest()).decode()
    return body, {"svix-id": msg_id, "svix-timestamp": ts, "svix-signature": f"v1,{sig}", "content-type": "application/json"}


def _received(sender, subject="Help", email_id=None):
    return {"type": "email.received", "data": {
        "email_id": email_id or f"em_{uuid.uuid4().hex[:10]}", "from": sender, "to": ["hello@tryclassmate.com"], "subject": subject,
    }}


def test_sender_is_configurable():
    assert main.EMAIL_FROM == "ClassMate <noreply@tryclassmate.com>"
    assert "onboarding@resend.dev" not in open(main.__file__).read().replace('os.getenv("EMAIL_FROM", "onboarding@resend.dev")', "").split("EMAIL_FROM =")[1]


def test_rejects_unsigned_and_bad_signatures():
    body, h = _signed(_received("a@b.edu"))
    assert client.post("/webhooks/resend", content=body, headers={"content-type": "application/json"}).status_code == 401
    _, bad = _signed(_received("a@b.edu"), secret=b"wrong")
    assert client.post("/webhooks/resend", content=body, headers=bad).status_code == 401
    old_body, old = _signed(_received("a@b.edu"), ts=time.time() - 3600)
    assert client.post("/webhooks/resend", content=old_body, headers=old).status_code == 401


def test_saves_forwards_dedupes_and_matches_account():
    email = f"student-{uuid.uuid4().hex[:6]}@example.edu"
    _user(email)
    SENT.clear()
    event = _received(f"Student <{email}>", subject="Refund please", email_id="em_dupe_test")
    body, h = _signed(event)
    r = client.post("/webhooks/resend", content=body, headers=h)
    assert r.status_code == 200 and r.json().get("saved"), r.text
    assert len(SENT) == 1 and SENT[0]["to"] == ["founder@example.com"] and SENT[0]["reply_to"] == email, SENT
    body2, h2 = _signed(event)  # Resend retry
    assert client.post("/webhooks/resend", content=body2, headers=h2).json() == {"duplicate": True}
    assert len(SENT) == 1

    inbox = client.get("/admin/inbox", headers=FOUNDER).json()["emails"]
    row = next(e for e in inbox if e["subject"] == "Refund please")
    assert row["from"] == email and row["text"] == "Body of em_dupe_test" and row["status"] == "new"
    assert row["account"] and row["account"]["tier"] == "free" and row["account"]["lms"] == []


def test_ignores_other_events_and_own_mail():
    body, h = _signed({"type": "email.delivered", "data": {}})
    assert client.post("/webhooks/resend", content=body, headers=h).json() == {"ignored": "email.delivered"}
    body, h = _signed(_received("noreply@tryclassmate.com"))
    assert client.post("/webhooks/resend", content=body, headers=h).json() == {"ignored": "own sender"}


def test_reply_threads_and_marks_replied():
    body, h = _signed(_received("stranger@gmail.com", subject="Question"))
    client.post("/webhooks/resend", content=body, headers=h)
    row = next(e for e in client.get("/admin/inbox", headers=FOUNDER).json()["emails"] if e["from"] == "stranger@gmail.com")
    assert row["account"] is None
    SENT.clear()
    r = client.post(f"/admin/inbox/{row['id']}/reply", json={"text": "Happy to help!"}, headers=FOUNDER)
    assert r.status_code == 200, r.text
    msg = SENT[0]
    assert msg["from"] == f"ClassMate <{main.SUPPORT_EMAIL}>" and msg["to"] == ["stranger@gmail.com"]
    assert msg["subject"] == "Re: Question" and msg["headers"]["In-Reply-To"].endswith("@mail>")
    assert all(e["id"] != row["id"] for e in client.get("/admin/inbox", headers=FOUNDER).json()["emails"])
    replied = client.get("/admin/inbox?status=replied", headers=FOUNDER).json()["emails"]
    assert any(e["id"] == row["id"] and e["reply_text"] == "Happy to help!" for e in replied)
    assert client.post(f"/admin/inbox/{row['id']}/status", json={"status": "archived"}, headers=FOUNDER).status_code == 200
    assert client.post(f"/admin/inbox/{row['id']}/status", json={"status": "deleted"}, headers=FOUNDER).status_code == 422


def test_inbox_is_founder_only():
    h = _user()
    assert client.get("/admin/inbox", headers=h).status_code == 403
    assert client.post("/admin/inbox/x/reply", json={"text": "hi"}, headers=h).status_code == 403


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    failed = 0
    for t in tests:
        try:
            t()
            print(f"PASS {t.__name__}")
        except Exception as e:  # noqa: BLE001
            failed += 1
            print(f"FAIL {t.__name__}: {e!r}")
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    os.unlink(_DB_PATH)
    raise SystemExit(1 if failed else 0)
