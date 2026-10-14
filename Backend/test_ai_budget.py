#!/usr/bin/env python3
"""
Tests for the AI spending caps (every OpenAI call is metered and capped):
  - each call's real token cost is recorded per user per day
  - a user over their daily budget gets a friendly 429; Free caps are lower than Pro
  - the site-wide daily ceiling stops all AI calls
  - streaming: the final usage chunk is recorded and never reaches the caller (it has no choices)
  - the request middleware charges calls to the signed-in user

No pytest in this project -- run directly: `python3 test_ai_budget.py`. Throwaway SQLite DB;
OpenAI is stubbed (nothing is sent).
"""
import asyncio
import os
import tempfile
import uuid
from types import SimpleNamespace

_DB_FD, _DB_PATH = tempfile.mkstemp(suffix=".db")
os.close(_DB_FD)
os.environ["OPENAI_API_KEY"] = "sk-test"
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_PATH}"
os.environ["JWT_SECRET"] = "test-jwt-secret-for-ai-budget"
os.environ.pop("PROMO_PRO_UNTIL", None)

from fastapi import HTTPException  # noqa: E402
from starlette.testclient import TestClient  # noqa: E402

import main  # noqa: E402

http = TestClient(main.app)
inner = main.client.chat.completions._inner


def usage(tin, tout):
    return SimpleNamespace(prompt_tokens=tin, completion_tokens=tout)


async def fake_create(**kw):
    if kw.get("stream"):
        async def gen():
            yield SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content="Hi"))], usage=None)
            yield SimpleNamespace(choices=[], usage=usage(1000, 500))  # include_usage chunk
        return gen()
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="ok"))], usage=usage(10_000, 1_000))


inner.create = fake_create


def _user():
    email = f"ai-{uuid.uuid4().hex[:8]}@example.edu"
    ip = f"198.24.{uuid.uuid4().int % 250}.{uuid.uuid4().int % 250 + 1}"
    r = http.post("/auth/register", json={"email": email, "password": "password123"}, headers={"X-Real-IP": ip})
    assert r.status_code == 200, r.text
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    return http.get("/me", headers=h).json()["user_id"], h


def _spent(uid):
    db = main.SessionLocal()
    try:
        return sum(r.cost_microusd for r in db.query(main.AiUsage).filter(main.AiUsage.user_id == uid).all())
    finally:
        db.close()


async def _call(uid, **kw):
    token = main._ai_user.set(uid)
    try:
        return await main.client.chat.completions.create(model="gpt-4.1-mini", messages=[], **kw)
    finally:
        main._ai_user.reset(token)


def test_records_real_cost():
    uid, _ = _user()
    asyncio.run(_call(uid))
    # 10k in * $0.40/M + 1k out * $1.60/M = $0.004 + $0.0016 = 5600 micro-dollars
    assert _spent(uid) == 5600, _spent(uid)


def test_daily_cap_blocks_with_friendly_message_and_free_is_lower():
    uid, _ = _user()  # free (no promo)
    calls = 0
    try:
        for _ in range(1000):
            asyncio.run(_call(uid))
            calls += 1
    except HTTPException as e:
        assert e.status_code == 429 and e.detail["limit_type"] == "ai_budget", e.detail
        assert "today's AI limit" in e.detail["message"] and "calendar" in e.detail["message"], e.detail
    free_calls = calls
    assert _spent(uid) <= main.AI_LIMITS["free"]["day"] * 1e6 + 5600, "stops right at the cap"

    os.environ["PROMO_PRO_UNTIL"] = "2099-12-31"
    try:
        pro, _ = _user()
        calls = 0
        try:
            for _ in range(1000):
                asyncio.run(_call(pro))
                calls += 1
        except HTTPException:
            pass
        assert calls > free_calls, (calls, free_calls)
        assert _spent(pro) <= main.AI_LIMITS["pro"]["day"] * 1e6 + 5600
    finally:
        os.environ.pop("PROMO_PRO_UNTIL", None)


def test_site_wide_ceiling():
    uid, _ = _user()
    old = main.AI_GLOBAL_DAILY_USD
    main.AI_GLOBAL_DAILY_USD = 0.000001
    try:
        try:
            asyncio.run(_call(uid))
            raise AssertionError("site-wide cap should block")
        except HTTPException as e:
            assert e.status_code == 429 and "short break" in e.detail["message"]
    finally:
        main.AI_GLOBAL_DAILY_USD = old


def test_stream_records_usage_and_hides_usage_chunk():
    uid, _ = _user()

    async def run():
        stream = await _call(uid, stream=True)
        return [c.choices[0].delta.content async for c in stream]

    assert asyncio.run(run()) == ["Hi"]
    assert _spent(uid) == round(1000 * 0.40 + 500 * 1.60), _spent(uid)


def test_middleware_charges_signed_in_user():
    uid, h = _user()
    seen = []

    @main.app.get("/_test_ai_user")
    async def _probe():
        seen.append(main._ai_user.get())
        return {}

    http.get("/_test_ai_user", headers=h)
    http.get("/_test_ai_user")
    assert seen == [uid, None], seen


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
