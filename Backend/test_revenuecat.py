#!/usr/bin/env python3
"""
Tests for the RevenueCat (App Store IAP) webhook and how IAP feeds into tier resolution.

No pytest in this project -- run directly: `python3 test_revenuecat.py`
(matches test_mobile_prep.py). Uses a throwaway SQLite file DB.

Covers:
  - auth: missing/wrong Authorization header is 401; "Bearer <secret>" and bare secret both work
  - INITIAL_PURCHASE grants Pro (/me and /me/subscription), billing_source == "app_store"
  - duplicate event id is a no-op
  - CANCELLATION (auto-renew off) keeps Pro until expiry; EXPIRATION removes it
  - a stale (older) event can't resurrect an expired grant
  - IAP expiry never downgrades a Stripe subscriber
  - TRANSFER moves the grant between accounts
  - unknown app_user_id / events without expiration (BILLING_ISSUE) / TEST are accepted with 200
  - web Stripe checkout is refused while App Store Pro is active
"""
import os
import tempfile
import time
import uuid

_DB_FD, _DB_PATH = tempfile.mkstemp(suffix=".db")
os.close(_DB_FD)
os.environ["OPENAI_API_KEY"] = "sk-test"
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_PATH}"
os.environ["JWT_SECRET"] = "test-jwt-secret-for-revenuecat"
os.environ["REVENUECAT_WEBHOOK_AUTH"] = "rc-test-secret"
os.environ["STRIPE_SECRET_KEY"] = "sk_test_dummy"
os.environ.pop("RESEND_API_KEY", None)

from starlette.testclient import TestClient  # noqa: E402

import main  # noqa: E402

client = TestClient(main.app)
AUTH = {"Authorization": "Bearer rc-test-secret"}
DAY_MS = 86_400_000


def _now_ms() -> int:
    return int(time.time() * 1000)


def _new_user():
    email = f"rc-{uuid.uuid4().hex[:8]}@example.edu"
    ip = f"198.51.{uuid.uuid4().int % 250}.{uuid.uuid4().int % 250 + 1}"
    r = client.post("/auth/register", json={"email": email, "password": "password123"}, headers={"X-Real-IP": ip})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    me = client.get("/me", headers={"Authorization": f"Bearer {token}"}).json()
    return me["user_id"], {"Authorization": f"Bearer {token}"}


def _event(event_type, app_user_id, *, expiration_ms=None, event_ms=None, **extra):
    ev = {
        "id": uuid.uuid4().hex,
        "type": event_type,
        "app_user_id": app_user_id,
        "original_app_user_id": app_user_id,
        "aliases": [app_user_id],
        "product_id": "classmate_pro_monthly",
        "store": "APP_STORE",
        "event_timestamp_ms": event_ms or _now_ms(),
    }
    if expiration_ms is not None or event_type in ("INITIAL_PURCHASE", "RENEWAL", "CANCELLATION", "EXPIRATION"):
        ev["expiration_at_ms"] = expiration_ms
    ev.update(extra)
    return {"api_version": "1.0", "event": ev}


def _post(body, headers=AUTH):
    return client.post("/revenuecat/webhook", json=body, headers=headers)


def _sub(headers):
    r = client.get("/me/subscription", headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def test_auth_required():
    uid, _ = _new_user()
    body = _event("INITIAL_PURCHASE", uid, expiration_ms=_now_ms() + 30 * DAY_MS)
    assert _post(body, headers={}).status_code == 401
    assert _post(body, headers={"Authorization": "Bearer wrong"}).status_code == 401
    assert _post(body, headers={"Authorization": "rc-test-secret"}).status_code == 200


def test_purchase_grants_pro_and_duplicate_is_noop():
    uid, h = _new_user()
    assert _sub(h)["is_pro"] is False
    body = _event("INITIAL_PURCHASE", uid, expiration_ms=_now_ms() + 30 * DAY_MS)
    r = _post(body)
    assert r.status_code == 200 and r.json() == {"received": True}, r.text
    s = _sub(h)
    assert s["is_pro"] and s["tier"] == "pro" and s["billing_source"] == "app_store", s
    assert s["iap_expires_at"], s
    assert client.get("/me", headers=h).json()["subscription"]["is_pro"] is True
    assert _post(body).json() == {"received": True, "duplicate": True}


def test_cancellation_keeps_access_until_expiration():
    uid, h = _new_user()
    t0 = _now_ms()
    _post(_event("INITIAL_PURCHASE", uid, expiration_ms=t0 + 30 * DAY_MS, event_ms=t0 - 3000))
    _post(_event("CANCELLATION", uid, expiration_ms=t0 + 30 * DAY_MS, event_ms=t0 - 2000, cancellation_reason="UNSUBSCRIBE"))
    assert _sub(h)["is_pro"] is True
    _post(_event("EXPIRATION", uid, expiration_ms=t0 - 1000, event_ms=t0 - 1000))
    s = _sub(h)
    assert s["is_pro"] is False and s["billing_source"] is None, s


def test_stale_event_cannot_resurrect():
    uid, h = _new_user()
    t0 = _now_ms()
    _post(_event("EXPIRATION", uid, expiration_ms=t0 - 1000, event_ms=t0))
    # A RENEWAL delivered late, stamped before the expiration, must be ignored
    _post(_event("RENEWAL", uid, expiration_ms=t0 + 30 * DAY_MS, event_ms=t0 - 60_000))
    assert _sub(h)["is_pro"] is False


def test_iap_expiry_does_not_downgrade_stripe():
    uid, h = _new_user()
    db = main.SessionLocal()
    try:
        p = db.query(main.UserProfile).filter(main.UserProfile.user_id == uid).first()
        p.subscription_tier = "pro"
        p.stripe_subscription_id = "sub_123"
        db.commit()
    finally:
        db.close()
    _post(_event("EXPIRATION", uid, expiration_ms=_now_ms() - 1000))
    s = _sub(h)
    assert s["is_pro"] is True and s["billing_source"] == "stripe", s


def test_transfer_moves_grant():
    a, ha = _new_user()
    b, hb = _new_user()
    _post(_event("INITIAL_PURCHASE", a, expiration_ms=_now_ms() + 30 * DAY_MS, event_ms=_now_ms() - 5000))
    assert _sub(ha)["is_pro"] is True
    r = _post({"api_version": "1.0", "event": {
        "id": uuid.uuid4().hex, "type": "TRANSFER", "event_timestamp_ms": _now_ms(),
        "transferred_from": [a], "transferred_to": [b],
    }})
    assert r.status_code == 200, r.text
    assert _sub(ha)["is_pro"] is False
    assert _sub(hb)["is_pro"] is True


def test_ignorable_events_return_200():
    uid, h = _new_user()
    assert _post(_event("TEST", uid)).status_code == 200
    assert _post(_event("BILLING_ISSUE", uid)).status_code == 200
    assert _post(_event("INITIAL_PURCHASE", "no-such-user", expiration_ms=_now_ms() + DAY_MS)).status_code == 200
    assert _sub(h)["is_pro"] is False
    assert _post({"nope": 1}).status_code == 400


def test_stripe_checkout_refused_while_iap_active():
    uid, h = _new_user()
    _post(_event("INITIAL_PURCHASE", uid, expiration_ms=_now_ms() + 30 * DAY_MS))
    r = client.post("/create-checkout-session", json={"plan": "monthly"}, headers=h)
    assert r.status_code == 400 and "App Store" in r.json()["detail"], r.text


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    failed = 0
    for t in tests:
        try:
            t()
            print(f"PASS {t.__name__}")
        except Exception as e:
            failed += 1
            print(f"FAIL {t.__name__}: {e!r}")
    os.unlink(_DB_PATH)
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    raise SystemExit(1 if failed else 0)
