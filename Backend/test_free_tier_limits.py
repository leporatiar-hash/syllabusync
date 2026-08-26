#!/usr/bin/env python3
"""
Direct verification that free-tier hard caps actually enforce:
- AI generation cap (FREE_AI_GENERATION_LIMIT, currently 50/month) via check_tier_limit()
  + increment_ai_generation(), the same functions the /summaries, /flashcards, and
  /generate-quiz endpoints call.
- Chat message cap (FREE_CHAT_MESSAGE_LIMIT, currently 20/week) via check_chat_limit(),
  the same function the /chat/conversations/{id}/messages endpoint calls.

This exercises the real DB-backed functions (not endpoints over HTTP) so it proves the
403 fires exactly at the limit, that the raised detail is the structured "limit_reached"
payload the frontend switches on, and that a Pro profile is exempt / gets its own higher
ceiling. It does not prove the HTTP layer wires check->increment correctly for every
endpoint -- that's confirmed separately by reading call sites in main.py.

No pytest in this project -- run directly: `python3 test_free_tier_limits.py`
(matches test_billing_tiers.py / test_chunking.py convention). Uses a throwaway SQLite
file DB.
"""
import os
import tempfile

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


def make_profile(db, **overrides):
    defaults = dict(
        user_id=main.generate_uuid(),
        email=f"{main.generate_uuid()}@classmate.local",
        subscription_tier="free",
        founding_member=False,
        founding_member_expires_at=None,
    )
    defaults.update(overrides)
    profile = main.UserProfile(**defaults)
    db.add(profile)
    db.commit()
    return profile


def test_free_ai_generation_cap_blocks_at_limit():
    db = main.SessionLocal()
    try:
        profile = make_profile(db)
        assert profile.email.lower() not in main.ALWAYS_PRO_EMAILS, "test profile must not hit the admin bypass"

        # Drive it right up to the limit exactly like the endpoints do:
        # check_tier_limit() before generating, increment_ai_generation() after success.
        for i in range(main.FREE_AI_GENERATION_LIMIT):
            main.check_tier_limit(db, profile.user_id, "ai_generation")  # must not raise
            main.increment_ai_generation(db, profile.user_id)

        db.refresh(profile)
        check(
            f"used counter reached the cap ({main.FREE_AI_GENERATION_LIMIT})",
            profile.ai_generations_used == main.FREE_AI_GENERATION_LIMIT,
        )

        # The next call (generation #51) must be blocked.
        try:
            main.check_tier_limit(db, profile.user_id, "ai_generation")
            check("51st generation should have raised HTTPException(403)", False)
        except main.HTTPException as e:
            check("51st generation blocked with 403", e.status_code == 403)
            check("blocked response has structured limit_reached payload", e.detail.get("error") == "limit_reached")
            check("blocked response reports correct max", e.detail.get("max") == main.FREE_AI_GENERATION_LIMIT)
            check("blocked response tells user to upgrade", "upgrade" in e.detail.get("message", "").lower())
    finally:
        db.close()


def test_pro_tier_has_no_ai_generation_cap():
    db = main.SessionLocal()
    try:
        profile = make_profile(db, subscription_tier="pro")
        # Blow way past the free limit -- must never raise for pro.
        for i in range(main.FREE_AI_GENERATION_LIMIT + 25):
            main.check_tier_limit(db, profile.user_id, "ai_generation")
        check("pro tier unaffected by FREE_AI_GENERATION_LIMIT", True)
    finally:
        db.close()


def test_free_chat_message_cap_blocks_at_limit():
    db = main.SessionLocal()
    try:
        profile = make_profile(db)

        for i in range(main.FREE_CHAT_MESSAGE_LIMIT):
            main.check_chat_limit(db, profile.user_id)  # must not raise
            profile.chat_messages_used = (profile.chat_messages_used or 0) + 1
            db.commit()

        db.refresh(profile)
        check(
            f"chat counter reached the cap ({main.FREE_CHAT_MESSAGE_LIMIT})",
            profile.chat_messages_used == main.FREE_CHAT_MESSAGE_LIMIT,
        )

        try:
            main.check_chat_limit(db, profile.user_id)
            check("21st chat message should have raised HTTPException(403)", False)
        except main.HTTPException as e:
            check("21st chat message blocked with 403", e.status_code == 403)
            check("blocked response has structured limit_reached payload", e.detail.get("error") == "limit_reached")
            check("blocked response reports correct max", e.detail.get("max") == main.FREE_CHAT_MESSAGE_LIMIT)
    finally:
        db.close()


def test_pro_tier_gets_higher_chat_cap_not_unlimited():
    db = main.SessionLocal()
    try:
        profile = make_profile(db, subscription_tier="pro")

        for i in range(main.PRO_CHAT_MESSAGE_LIMIT):
            main.check_chat_limit(db, profile.user_id)
            profile.chat_messages_used = (profile.chat_messages_used or 0) + 1
            db.commit()

        try:
            main.check_chat_limit(db, profile.user_id)
            check(f"pro's {main.PRO_CHAT_MESSAGE_LIMIT + 1}th message should have raised HTTPException(403)", False)
        except main.HTTPException as e:
            check("pro tier IS capped too, just at a higher ceiling", e.status_code == 403)
            check("pro cap value matches PRO_CHAT_MESSAGE_LIMIT", e.detail.get("max") == main.PRO_CHAT_MESSAGE_LIMIT)
    finally:
        db.close()


def test_profile_is_always_created_on_register_so_no_profile_bypass_in_practice():
    # check_tier_limit's ai_generation branch silently no-ops if profile is None ("no
    # profile yet = no generations tracked"). That's only safe if every real user always
    # has a profile row by the time they can call a generation endpoint. Confirm the
    # register flow creates one synchronously (main.py:2381-ish) rather than lazily.
    import inspect
    src = inspect.getsource(main)
    register_idx = src.index('@app.post("/auth/register"')
    register_src = src[register_idx:register_idx + 3000]
    check(
        "auth/register creates a UserProfile row before returning tokens",
        "profile = UserProfile(" in register_src and "db.add(profile)" in register_src,
    )


if __name__ == "__main__":
    print("=" * 60)
    print("Testing free-tier hard cap enforcement")
    print("=" * 60)

    test_free_ai_generation_cap_blocks_at_limit()
    test_pro_tier_has_no_ai_generation_cap()
    test_free_chat_message_cap_blocks_at_limit()
    test_pro_tier_gets_higher_chat_cap_not_unlimited()
    test_profile_is_always_created_on_register_so_no_profile_bypass_in_practice()

    print("=" * 60)
    print("All tests passed!")
    print("=" * 60)

    os.remove(_DB_PATH)
