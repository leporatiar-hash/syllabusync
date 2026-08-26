#!/usr/bin/env python3
"""
Basic tests for the three-tier billing logic: founding-member 365-day expiry,
_effective_tier's fallback to an active subscription, and price-id resolution
strictly from env vars (never lookup key / amount matching).

No pytest in this project — run directly: `python3 test_billing_tiers.py`
(matches the existing test_chunking.py convention). Uses a throwaway SQLite
file DB (no new dependencies).
"""
import os
import tempfile
from datetime import datetime, timedelta

_DB_FD, _DB_PATH = tempfile.mkstemp(suffix=".db")
os.close(_DB_FD)
os.environ["OPENAI_API_KEY"] = "sk-test"
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_PATH}"
os.environ["STRIPE_SECRET_KEY"] = "sk_test_dummy"
os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_test_secret"

import main  # noqa: E402


def check(name: str, condition: bool):
    status = "PASS" if condition else "FAIL"
    print(f"[{status}] {name}")
    if not condition:
        raise AssertionError(name)


def make_profile(**overrides):
    defaults = dict(
        user_id=main.generate_uuid(),
        email="test@classmate.local",
        subscription_tier="free",
        founding_member=False,
        founding_member_expires_at=None,
    )
    defaults.update(overrides)
    return main.UserProfile(**defaults)


def test_no_founding_purchase_is_free():
    profile = make_profile()
    check("never purchased founding -> free tier", main._effective_tier(profile) == "free")
    check("_founding_member_active is False", main._founding_member_active(profile) is False)


def test_active_founding_grant_is_pro():
    profile = make_profile(
        founding_member=True,
        founding_member_expires_at=datetime.utcnow() + timedelta(days=364),
    )
    check("active grant (day 364 of 365) -> pro", main._effective_tier(profile) == "pro")
    check("_founding_member_active is True", main._founding_member_active(profile) is True)


def test_expired_founding_grant_falls_back_to_free():
    profile = make_profile(
        founding_member=True,
        founding_member_expires_at=datetime.utcnow() - timedelta(days=1),
        subscription_tier="free",
    )
    check("expired grant with no subscription -> free tier", main._effective_tier(profile) == "free")
    check("_founding_member_active is False once expired", main._founding_member_active(profile) is False)


def test_expired_founding_grant_does_not_clobber_active_subscription():
    profile = make_profile(
        founding_member=True,
        founding_member_expires_at=datetime.utcnow() - timedelta(days=1),
        subscription_tier="pro",  # e.g. separately subscribed monthly
    )
    check("expired founding + active subscription -> still pro", main._effective_tier(profile) == "pro")


def test_pre_expiry_column_rows_treated_as_active():
    # Rows from before this column existed, if the migration backfill somehow missed one.
    profile = make_profile(founding_member=True, founding_member_expires_at=None)
    check("founding_member=True with null expiry -> treated as active", main._founding_member_active(profile) is True)


def test_resolve_plan_price_id_reads_env_var_directly():
    os.environ["STRIPE_PRICE_FOUNDING"] = "price_test_founding_123"
    try:
        price_id = main._resolve_plan_price_id("founding")
        check("resolves founding price id from STRIPE_PRICE_FOUNDING", price_id == "price_test_founding_123")
    finally:
        del os.environ["STRIPE_PRICE_FOUNDING"]


def test_resolve_plan_price_id_rejects_missing_env_var():
    os.environ.pop("STRIPE_PRICE_MONTHLY", None)
    try:
        main._resolve_plan_price_id("monthly")
        check("missing STRIPE_PRICE_MONTHLY should have raised", False)
    except main.HTTPException as e:
        check("missing env var raises HTTPException 500", e.status_code == 500)


def test_resolve_plan_price_id_rejects_non_price_id_value():
    # This is the exact shape of the historical bug: a dollar-amount string instead
    # of a Stripe Price id.
    os.environ["STRIPE_PRICE_YEARLY"] = "39.99"
    try:
        main._resolve_plan_price_id("yearly")
        check("dollar-amount value should have been rejected", False)
    except main.HTTPException as e:
        check("non-price_ value raises HTTPException 500 instead of hitting Stripe", e.status_code == 500)
    finally:
        del os.environ["STRIPE_PRICE_YEARLY"]


if __name__ == "__main__":
    print("=" * 60)
    print("Testing billing tier logic")
    print("=" * 60)

    test_no_founding_purchase_is_free()
    test_active_founding_grant_is_pro()
    test_expired_founding_grant_falls_back_to_free()
    test_expired_founding_grant_does_not_clobber_active_subscription()
    test_pre_expiry_column_rows_treated_as_active()
    test_resolve_plan_price_id_reads_env_var_directly()
    test_resolve_plan_price_id_rejects_missing_env_var()
    test_resolve_plan_price_id_rejects_non_price_id_value()

    print("=" * 60)
    print("All tests passed!")
    print("=" * 60)

    os.remove(_DB_PATH)
