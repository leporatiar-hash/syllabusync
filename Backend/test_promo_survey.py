#!/usr/bin/env python3
"""
Tests for the fall-2026 changes: free Pro for everyone until a date, the new plans (monthly $4.99,
6-month "semester"; founding and yearly retired), and the feedback survey.

No pytest in this project -- run directly: `python3 test_promo_survey.py`. Throwaway SQLite DB.
"""
import os
import tempfile
import uuid
from datetime import datetime, timedelta

_DB_FD, _DB_PATH = tempfile.mkstemp(suffix=".db")
os.close(_DB_FD)
os.environ["OPENAI_API_KEY"] = "sk-test"
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_PATH}"
os.environ["JWT_SECRET"] = "test-jwt-secret-for-promo"
os.environ["STRIPE_SECRET_KEY"] = "sk_test_dummy"
os.environ.pop("PROMO_PRO_UNTIL", None)
for k in ("STRIPE_PRICE_MONTHLY", "STRIPE_PRICE_SEMESTER"):
    os.environ.pop(k, None)

from starlette.testclient import TestClient  # noqa: E402

import main  # noqa: E402

client = TestClient(main.app)


def _user(email=None):
    email = email or f"p-{uuid.uuid4().hex[:8]}@example.edu"
    ip = f"198.21.{uuid.uuid4().int % 250}.{uuid.uuid4().int % 250 + 1}"
    r = client.post("/auth/register", json={"email": email, "password": "password123"}, headers={"X-Real-IP": ip})
    assert r.status_code == 200, r.text
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    return client.get("/me", headers=h).json()["user_id"], h


def _age(uid, days):
    db = main.SessionLocal()
    try:
        db.query(main.User).filter(main.User.id == uid).update({"created_at": datetime.utcnow() - timedelta(days=days)})
        db.commit()
    finally:
        db.close()


def test_promo_off_by_default():
    _, h = _user()
    s = client.get("/me/subscription", headers=h).json()
    assert s["is_pro"] is False and s["promo_until"] is None and s["ai_generations_max"] == main.FREE_AI_GENERATION_LIMIT, s


def test_promo_gives_everyone_pro_until_date():
    _, h = _user()
    try:
        os.environ["PROMO_PRO_UNTIL"] = (datetime.utcnow() + timedelta(days=30)).strftime("%Y-%m-%d")
        s = client.get("/me/subscription", headers=h).json()
        assert s["is_pro"] and s["promo_until"] and s["billing_source"] == "promo" and s["ai_generations_max"] is None, s
        assert client.get("/me", headers=h).json()["subscription"]["is_pro"] is True
        # The promo date is inclusive: it still applies on that day
        os.environ["PROMO_PRO_UNTIL"] = datetime.utcnow().strftime("%Y-%m-%d")
        assert client.get("/me/subscription", headers=h).json()["is_pro"] is True
        os.environ["PROMO_PRO_UNTIL"] = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")
        s = client.get("/me/subscription", headers=h).json()
        assert s["is_pro"] is False and s["promo_until"] is None, s
        os.environ["PROMO_PRO_UNTIL"] = "not-a-date"
        assert client.get("/me/subscription", headers=h).json()["is_pro"] is False
    finally:
        os.environ.pop("PROMO_PRO_UNTIL", None)


def test_retired_plans_refused_new_plan_accepted():
    _, h = _user()
    for plan in ("founding", "yearly"):
        r = client.post("/create-checkout-session", json={"plan": plan}, headers=h)
        assert r.status_code == 400 and "no longer offered" in r.json()["detail"], r.text
    # semester is a valid plan; here it stops at the missing price id, not at validation
    r = client.post("/create-checkout-session", json={"plan": "semester"}, headers=h)
    assert r.status_code == 500 and "STRIPE_PRICE_SEMESTER" in r.json()["detail"], r.text
    assert client.post("/create-checkout-session", json={"plan": "lifetime"}, headers=h).status_code == 422


def test_existing_founding_members_keep_pro():
    uid, h = _user()
    db = main.SessionLocal()
    try:
        p = db.query(main.UserProfile).filter(main.UserProfile.user_id == uid).first()
        p.founding_member = True
        p.founding_member_expires_at = datetime.utcnow() + timedelta(days=100)
        db.commit()
    finally:
        db.close()
    s = client.get("/me/subscription", headers=h).json()
    assert s["is_pro"] and s["billing_source"] == "founding", s


def test_survey_flow():
    uid, h = _user()
    assert client.get("/me/survey", headers=h).json()["show"] is False, "brand-new signups aren't asked"
    _age(uid, 10)
    assert client.get("/me/survey", headers=h).json()["show"] is True
    r = client.post("/me/survey", json={"answers": {"disappointed": "very", "missing": "phone reminders", "call": "yes", "contact": "555-0100"}}, headers=h)
    assert r.json() == {"saved": True}, r.text
    assert client.get("/me/survey", headers=h).json()["show"] is False
    # A later "dismiss" never erases an answer
    client.post("/me/survey", json={"dismissed": True}, headers=h)

    uid2, h2 = _user()
    _age(uid2, 10)
    client.post("/me/survey", json={"dismissed": True}, headers=h2)
    assert client.get("/me/survey", headers=h2).json()["show"] is False

    assert client.get("/admin/survey-responses", headers=h).status_code == 403
    _, admin = _user("leporatiar@g.cofc.edu")
    res = client.get("/admin/survey-responses", headers=admin).json()
    assert res["answered"] == 1 and res["dismissed"] == 1, res
    assert res["responses"][0]["answers"]["missing"] == "phone reminders", res
    assert client.post("/me/survey", json={"answers": {"x": "y" * 9000}}, headers=h).status_code == 422


def test_checkout_terms_529_description_and_confirmation_email():
    uid, h = _user()
    client.post("/me/profile", json={"full_name": "Alex Smith", "school_name": "College of Charleston"}, headers=h)
    captured, sent = {}, []

    class _S:
        url = "https://checkout.stripe.test/s"

    def fake_create(**kw):
        captured.update(kw)
        return _S()

    orig = (main.stripe_lib.checkout.Session.create, main.stripe_lib.Customer.create, main.RESEND_API_KEY, main.resend.Emails.send)
    main.stripe_lib.checkout.Session.create = fake_create
    main.stripe_lib.Customer.create = lambda **kw: type("C", (), {"id": "cus_test"})()
    os.environ["STRIPE_PRICE_SEMESTER"] = "price_semester_test"
    try:
        r = client.post("/create-checkout-session", json={"plan": "semester"}, headers=h)
        assert r.status_code == 200, r.text
        assert captured["subscription_data"]["description"] == "Educational software subscription: ClassMate Pro, used by Alex Smith, College of Charleston", captured
        assert "every 6 months" in captured["custom_text"]["submit"]["message"] and "refund" in captured["custom_text"]["submit"]["message"]
        # Confirmation email
        main.RESEND_API_KEY = "re_test"
        main.resend.Emails.send = lambda payload: sent.append(payload)
        db = main.SessionLocal()
        try:
            p = db.query(main.UserProfile).filter(main.UserProfile.user_id == uid).first()
            main._send_subscription_confirmation(p, "semester", 1999)
        finally:
            db.close()
        html = sent[0]["html"]
        assert "$19.99 every 6 months" in html and "Manage Subscription" in html and "14 days" in html and "529" in html, html
    finally:
        main.stripe_lib.checkout.Session.create, main.stripe_lib.Customer.create, main.RESEND_API_KEY, main.resend.Emails.send = orig
        os.environ.pop("STRIPE_PRICE_SEMESTER", None)


if __name__ == "__main__":
    main.Base.metadata.create_all(bind=main.engine)
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
