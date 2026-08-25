#!/usr/bin/env python3
"""
Basic tests for the Stripe webhook handler (POST /stripe/webhook).

No pytest in this project — run directly: `python3 test_stripe_webhook.py`
(matches the existing test_chunking.py convention). Uses a throwaway SQLite
file DB and FastAPI's bundled TestClient (no new dependencies).

Covers:
  - a validly signed checkout.session.completed (mode=payment) flips the user
    to a founding member
  - a badly signed request is rejected (400) and makes no DB changes
  - a redelivered event (same event id) is a no-op, not reprocessed
  - an unhandled event type is accepted (200) and ignored
"""
import json
import os
import tempfile
import time
import uuid

# Env vars must be set before importing main — it reads them at import time.
_DB_FD, _DB_PATH = tempfile.mkstemp(suffix=".db")
os.close(_DB_FD)
os.environ["OPENAI_API_KEY"] = "sk-test"
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_PATH}"
os.environ["STRIPE_SECRET_KEY"] = "sk_test_dummy"
os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_test_secret"

import stripe as stripe_lib  # noqa: E402
from starlette.testclient import TestClient  # noqa: E402

import main  # noqa: E402

# Not used as `with TestClient(app) as client:` on purpose — that would run
# @app.on_event("startup"), which tries a real network JWKS fetch. The webhook
# route doesn't depend on startup having run.
client = TestClient(main.app)

WEBHOOK_SECRET = os.environ["STRIPE_WEBHOOK_SECRET"]


def sign(payload: bytes, secret: str = WEBHOOK_SECRET, timestamp: int | None = None) -> str:
    """Build a valid Stripe-Signature header value for `payload`."""
    ts = timestamp if timestamp is not None else int(time.time())
    signed_payload = f"{ts}.{payload.decode('utf-8')}"
    sig = stripe_lib.WebhookSignature._compute_signature(signed_payload, secret)
    return f"t={ts},v1={sig}"


def make_checkout_completed_event(event_id: str, user_id: str, customer_id: str = "cus_test123") -> bytes:
    event = {
        "id": event_id,
        "object": "event",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_test_" + uuid.uuid4().hex[:8],
                "object": "checkout.session",
                "mode": "payment",
                "customer": customer_id,
                "client_reference_id": user_id,
                "metadata": {"user_id": user_id, "plan": "founding"},
                "subscription": None,
            }
        },
    }
    return json.dumps(event).encode("utf-8")


def make_unhandled_event(event_id: str) -> bytes:
    event = {
        "id": event_id,
        "object": "event",
        "type": "customer.created",  # a real Stripe event type this handler doesn't act on
        "data": {"object": {"id": "cus_test_unhandled"}},
    }
    return json.dumps(event).encode("utf-8")


def seed_user() -> tuple[str, str]:
    """Create a User + UserProfile directly in the DB, return (user_id, email)."""
    db = main.SessionLocal()
    try:
        user_id = main.generate_uuid()
        email = f"{user_id}@test.classmate.local"
        db.add(main.User(id=user_id, email=email))
        db.add(main.UserProfile(user_id=user_id, email=email))
        db.commit()
        return user_id, email
    finally:
        db.close()


def get_profile(user_id: str):
    db = main.SessionLocal()
    try:
        return db.query(main.UserProfile).filter(main.UserProfile.user_id == user_id).first()
    finally:
        db.close()


def count_webhook_events(event_id: str) -> int:
    db = main.SessionLocal()
    try:
        return db.query(main.StripeWebhookEvent).filter(main.StripeWebhookEvent.id == event_id).count()
    finally:
        db.close()


def check(name: str, condition: bool):
    status = "PASS" if condition else "FAIL"
    print(f"[{status}] {name}")
    if not condition:
        raise AssertionError(name)


def test_valid_event_flips_user_to_founding_member():
    user_id, _ = seed_user()
    payload = make_checkout_completed_event("evt_valid_1", user_id)
    headers = {"stripe-signature": sign(payload), "content-type": "application/json"}

    resp = client.post("/stripe/webhook", content=payload, headers=headers)

    check("valid event returns 200", resp.status_code == 200)
    profile = get_profile(user_id)
    check("valid event sets founding_member=True", bool(profile.founding_member) is True)


def test_bad_signature_is_rejected():
    user_id, _ = seed_user()
    payload = make_checkout_completed_event("evt_bad_sig_1", user_id)
    bad_headers = {"stripe-signature": "t=1,v1=deadbeef", "content-type": "application/json"}

    resp = client.post("/stripe/webhook", content=payload, headers=bad_headers)

    check("bad signature returns 400", resp.status_code == 400)
    profile = get_profile(user_id)
    check("bad signature makes no DB change", bool(profile.founding_member) is False)


def test_duplicate_event_is_a_noop():
    user_id, _ = seed_user()
    event_id = "evt_duplicate_1"
    payload = make_checkout_completed_event(event_id, user_id)
    headers = {"stripe-signature": sign(payload), "content-type": "application/json"}

    first = client.post("/stripe/webhook", content=payload, headers=headers)
    check("first delivery returns 200", first.status_code == 200)
    check("first delivery is not flagged duplicate", first.json().get("duplicate") is not True)

    # Redeliver — same event id, freshly signed (Stripe re-signs retries with a new timestamp).
    second = client.post("/stripe/webhook", content=payload, headers={"stripe-signature": sign(payload), "content-type": "application/json"})
    check("redelivery still returns 200 (not an error)", second.status_code == 200)
    check("redelivery is flagged duplicate", second.json().get("duplicate") is True)
    check("event id recorded exactly once", count_webhook_events(event_id) == 1)


def test_unhandled_event_type_is_ignored():
    payload = make_unhandled_event("evt_unhandled_1")
    headers = {"stripe-signature": sign(payload), "content-type": "application/json"}

    resp = client.post("/stripe/webhook", content=payload, headers=headers)

    check("unhandled event type still returns 200", resp.status_code == 200)


if __name__ == "__main__":
    print("=" * 60)
    print("Testing Stripe webhook handler")
    print("=" * 60)

    test_valid_event_flips_user_to_founding_member()
    test_bad_signature_is_rejected()
    test_duplicate_event_is_a_noop()
    test_unhandled_event_type_is_ignored()

    print("=" * 60)
    print("All tests passed!")
    print("=" * 60)

    os.remove(_DB_PATH)
