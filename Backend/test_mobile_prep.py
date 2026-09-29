#!/usr/bin/env python3
"""
Tests for the mobile-launch backend prep: auth rate limits and GET /app/config.

No pytest in this project -- run directly: `python3 test_mobile_prep.py`
(matches test_ical_sync.py). Uses a throwaway SQLite file DB.

Covers:
  - /app/config: defaults to 1.0.0 / 1.0.0, env vars override without a code change
  - login: 10/min per account (11th attempt on one email is 429 even from fresh IPs; other
    accounts on the same IP are unaffected) and 30/min per IP (X-Real-IP, not the socket address)
  - register: 10/min per IP; a different X-Real-IP gets its own bucket
  - forgot-password: 5/min per account
  - a successful login still returns tokens under the limit

The limiter's in-memory storage is shared across the whole run, so every test uses its own
emails and IPs.
"""
import os
import tempfile
import uuid

# Env vars must be set before importing main -- it reads them at import time.
_DB_FD, _DB_PATH = tempfile.mkstemp(suffix=".db")
os.close(_DB_FD)
os.environ["OPENAI_API_KEY"] = "sk-test"
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_PATH}"
os.environ["JWT_SECRET"] = "test-jwt-secret-for-mobile-prep"
os.environ.pop("RESEND_API_KEY", None)  # forgot-password must not send real email

from starlette.testclient import TestClient  # noqa: E402

import main  # noqa: E402

client = TestClient(main.app)


def _email(tag: str) -> str:
    return f"{tag}-{uuid.uuid4().hex[:8]}@example.edu"


def _ip() -> str:
    n = uuid.uuid4().int
    return f"203.0.{n % 250}.{(n >> 8) % 250 + 1}"


def test_app_config_defaults_and_env_override():
    os.environ.pop("MOBILE_MIN_SUPPORTED_VERSION", None)
    os.environ.pop("MOBILE_LATEST_VERSION", None)
    r = client.get("/app/config")
    assert r.status_code == 200, r.text
    assert r.json() == {"min_supported_version": "1.0.0", "latest_version": "1.0.0"}, r.json()

    os.environ["MOBILE_MIN_SUPPORTED_VERSION"] = "1.2.0"
    os.environ["MOBILE_LATEST_VERSION"] = "1.3.1"
    try:
        r = client.get("/app/config")
        assert r.json() == {"min_supported_version": "1.2.0", "latest_version": "1.3.1"}, r.json()
    finally:
        os.environ.pop("MOBILE_MIN_SUPPORTED_VERSION", None)
        os.environ.pop("MOBILE_LATEST_VERSION", None)
    # No auth needed: the app calls it before login.
    assert "authorization" not in {k.lower() for k in r.request.headers}
    print("  ok  /app/config defaults + env override, no auth")


def test_login_limit_per_account():
    email = _email("victim")
    statuses = [
        client.post("/auth/login", json={"email": email, "password": "wrong"},
                    headers={"X-Real-IP": _ip()}).status_code
        for _ in range(11)
    ]
    assert statuses[:10] == [401] * 10, statuses
    assert statuses[10] == 429, statuses
    # Case/whitespace variants of the same email share the bucket.
    r = client.post("/auth/login", json={"email": f"  {email.upper()} ", "password": "wrong"},
                    headers={"X-Real-IP": _ip()})
    assert r.status_code == 429, r.status_code
    # A different account from the same IP is unaffected.
    ip = _ip()
    r = client.post("/auth/login", json={"email": _email("other"), "password": "wrong"},
                    headers={"X-Real-IP": ip})
    assert r.status_code == 401, r.status_code
    print("  ok  login: 10/min per account, normalized email, other accounts unaffected")


def test_login_limit_per_ip():
    ip = _ip()
    statuses = [
        client.post("/auth/login", json={"email": _email("spray"), "password": "wrong"},
                    headers={"X-Real-IP": ip}).status_code
        for _ in range(31)
    ]
    assert statuses[:30] == [401] * 30, statuses
    assert statuses[30] == 429, statuses
    # A different real client IP gets its own bucket (proves X-Real-IP is the key, not the socket).
    r = client.post("/auth/login", json={"email": _email("spray"), "password": "wrong"},
                    headers={"X-Real-IP": _ip()})
    assert r.status_code == 401, r.status_code
    print("  ok  login: 30/min per X-Real-IP")


def test_register_limit_per_ip():
    ip = _ip()
    statuses = [
        client.post("/auth/register", json={"email": _email("new"), "password": "secret123"},
                    headers={"X-Real-IP": ip}).status_code
        for _ in range(11)
    ]
    assert statuses[:10] == [200] * 10, statuses
    assert statuses[10] == 429, statuses
    r = client.post("/auth/register", json={"email": _email("new"), "password": "secret123"},
                    headers={"X-Real-IP": _ip()})
    assert r.status_code == 200, r.text
    print("  ok  register: 10/min per X-Real-IP")


def test_forgot_password_limit_per_account():
    email = _email("forgot")
    statuses = [
        client.post("/auth/forgot-password", json={"email": email},
                    headers={"X-Real-IP": _ip()}).status_code
        for _ in range(6)
    ]
    assert statuses[:5] == [200] * 5, statuses
    assert statuses[5] == 429, statuses
    print("  ok  forgot-password: 5/min per account")


def test_successful_login_under_limit():
    email = _email("happy")
    ip = _ip()
    r = client.post("/auth/register", json={"email": email, "password": "secret123"},
                    headers={"X-Real-IP": ip})
    assert r.status_code == 200, r.text
    r = client.post("/auth/login", json={"email": email, "password": "secret123"},
                    headers={"X-Real-IP": ip})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["access_token"] and body["refresh_token"], body
    print("  ok  successful login returns tokens")


def test_client_ip_falls_back_without_header():
    # TestClient's socket address is "testclient"; with no X-Real-IP the key falls back to it.
    from starlette.requests import Request
    scope = {"type": "http", "headers": [], "client": ("10.0.0.9", 1234)}
    assert main.client_ip(Request(scope)) == "10.0.0.9"
    scope = {"type": "http", "headers": [(b"x-real-ip", b"198.51.100.7")], "client": ("100.64.0.3", 1)}
    assert main.client_ip(Request(scope)) == "198.51.100.7"
    print("  ok  client_ip prefers X-Real-IP, falls back to socket address")


if __name__ == "__main__":
    try:
        main.Base.metadata.create_all(bind=main.engine)
        test_app_config_defaults_and_env_override()
        test_login_limit_per_account()
        test_login_limit_per_ip()
        test_register_limit_per_ip()
        test_forgot_password_limit_per_account()
        test_successful_login_under_limit()
        test_client_ip_falls_back_without_header()
        print("\nAll mobile-prep tests passed.")
    finally:
        try:
            os.remove(_DB_PATH)
        except OSError:
            pass
