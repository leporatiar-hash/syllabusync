#!/usr/bin/env python3
"""
Tests for "Where do you go?": school search, email suggestion, LMS detection caching, typed-in
LMS addresses, and remembering a connected LMS for classmates.

No pytest in this project -- run directly: `python3 test_schools.py`. Throwaway SQLite DB; the
network probes in schools.py are stubbed, so nothing leaves the machine.
"""
import asyncio
import os
import tempfile
import uuid

_DB_FD, _DB_PATH = tempfile.mkstemp(suffix=".db")
os.close(_DB_FD)
os.environ["OPENAI_API_KEY"] = "sk-test"
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_PATH}"
os.environ["JWT_SECRET"] = "test-jwt-secret-for-schools"
os.environ.pop("RESEND_API_KEY", None)

from starlette.testclient import TestClient  # noqa: E402

import main  # noqa: E402
import schools  # noqa: E402

client = TestClient(main.app)

DETECT_CALLS = []
IDENTIFY = {
    "lms.cofc.edu": schools.lms_option("brightspace", "lms.cofc.edu", "manual"),
    "elearn.mtsu.edu": schools.lms_option("brightspace", "elearn.mtsu.edu", "manual"),
    "evil.instructure.com": schools.lms_option("canvas", "evil.instructure.com", "manual"),
}


async def fake_detect(domain, name):
    DETECT_CALLS.append(domain)
    return {"cofc.edu": [schools.lms_option("brightspace", "lms.cofc.edu", "probe")]}.get(domain, [])


async def fake_identify(host):
    return dict(IDENTIFY[host]) if host in IDENTIFY else None


schools.detect = fake_detect
schools.identify = fake_identify


def _user(email=None):
    email = email or f"s-{uuid.uuid4().hex[:8]}@example.com"
    ip = f"198.20.{uuid.uuid4().int % 250}.{uuid.uuid4().int % 250 + 1}"
    r = client.post("/auth/register", json={"email": email, "password": "password123"}, headers={"X-Real-IP": ip})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_search_and_suggest():
    h = _user()
    names = [s["name"] for s in client.get("/schools/search", params={"q": "cofc"}, headers=h).json()]
    assert names[0] == "College of Charleston", names
    names = [s["name"] for s in client.get("/schools/search", params={"q": "college of charl"}, headers=h).json()]
    assert names[0] == "College of Charleston", names
    assert client.get("/schools/search", params={"q": ""}, headers=h).json() == []
    assert client.get("/schools/suggest", headers=h).json() == {"school": None}
    h2 = _user(f"s{uuid.uuid4().hex[:6]}@g.cofc.edu")
    assert client.get("/schools/suggest", headers=h2).json()["school"] == {"name": "College of Charleston", "domain": "cofc.edu"}


def test_lms_detection_cached_and_directory_only():
    h = _user()
    db = main.SessionLocal()
    db.query(main.SchoolLms).delete()
    db.commit()
    db.close()
    DETECT_CALLS.clear()
    r = client.get("/schools/lms", params={"domain": "cofc.edu"}, headers=h).json()
    assert r["options"][0]["host"] == "lms.cofc.edu" and r["options"][0]["name"] == "OAKS", r
    client.get("/schools/lms", params={"domain": "g.cofc.edu"}, headers=h)
    assert DETECT_CALLS == ["cofc.edu"], "second lookup (via a subdomain) comes from the cache"
    r = client.get("/schools/lms", params={"domain": "mtsu.edu"}, headers=h).json()
    assert r["options"] == [], r
    assert client.get("/schools/lms", params={"domain": "localhost"}, headers=h).status_code == 404
    assert client.get("/schools/lms", params={"domain": "internal.corp"}, headers=h).status_code == 404


def test_identify_typed_address():
    h = _user()
    r = client.post("/schools/lms/identify", json={"url": "https://elearn.mtsu.edu/d2l/home"}, headers=h)
    assert r.status_code == 200 and r.json()["provider"] == "brightspace", r.text
    assert client.post("/schools/lms/identify", json={"url": "not a url"}, headers=h).status_code == 400
    assert client.post("/schools/lms/identify", json={"url": "example.org"}, headers=h).status_code == 400


def test_confirm_shares_with_classmates_only_when_trusted():
    # MTSU student connects elearn.mtsu.edu: on the school's own domain, so classmates get it
    h = _user(f"s{uuid.uuid4().hex[:6]}@mtmail.mtsu.edu")
    r = client.post("/schools/lms/confirm", json={"domain": "mtsu.edu", "provider": "brightspace", "host": "elearn.mtsu.edu"}, headers=h)
    assert r.json() == {"saved": True, "shared": True}, r.text
    other = _user()
    opts = client.get("/schools/lms", params={"domain": "mtsu.edu"}, headers=other).json()["options"]
    assert opts[0]["host"] == "elearn.mtsu.edu" and opts[0]["source"] == "confirmed", opts
    me = client.get("/me", headers=h).json()["profile"]
    assert (me["school_domain"], me["lms_provider"], me["lms_host"]) == ("mtsu.edu", "brightspace", "elearn.mtsu.edu"), me

    # A gmail user can't repoint CofC at some other Canvas for everyone (saved only to their profile)
    g = _user()
    r = client.post("/schools/lms/confirm", json={"domain": "cofc.edu", "provider": "canvas", "host": "evil.instructure.com"}, headers=g)
    assert r.json() == {"saved": True, "shared": False}, r.text
    opts = client.get("/schools/lms", params={"domain": "cofc.edu"}, headers=other).json()["options"]
    assert opts[0]["host"] == "lms.cofc.edu", opts
    # And the provider has to match what's really at the host
    r = client.post("/schools/lms/confirm", json={"domain": "cofc.edu", "provider": "canvas", "host": "lms.cofc.edu"}, headers=g)
    assert r.json() == {"saved": False}, r.text


def test_profile_school_change_clears_lms():
    h = _user()
    client.post("/me/profile", json={"school_name": "College of Charleston", "school_domain": "cofc.edu",
                                     "lms_provider": "brightspace", "lms_host": "lms.cofc.edu"}, headers=h)
    p = client.get("/me", headers=h).json()["profile"]
    assert (p["school_domain"], p["lms_host"]) == ("cofc.edu", "lms.cofc.edu"), p
    client.post("/me/profile", json={"school_name": "Clemson University", "school_domain": "clemson.edu"}, headers=h)
    p = client.get("/me", headers=h).json()["profile"]
    assert (p["school_domain"], p["lms_host"]) == ("clemson.edu", None), p


def test_logo_choice():
    # Athletics marks win over wordmarks/script versions; images come back as Commons PNG renders
    marks = ["http://commons.wikimedia.org/wiki/Special:FilePath/Clemson%20Tigers%20Woodmark.png",
             "http://commons.wikimedia.org/wiki/Special:FilePath/Clemson%20Tigers%20logo.svg"]
    assert sorted(marks, key=schools._mark_score, reverse=True)[0].endswith("logo.svg")
    assert schools._mark_score(marks[0]) < 0
    assert schools._commons_png(marks[1], 256) == "https://commons.wikimedia.org/wiki/Special:FilePath/Clemson%20Tigers%20logo.svg?width=256"
    # PNG / ICO size sniffing
    png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 8 + (180).to_bytes(4, "big") + (180).to_bytes(4, "big")
    assert schools._image_size(png) == 180
    ico = b"\x00\x00\x01\x00\x02\x00" + bytes([16]) + b"\x00" * 15 + bytes([0]) + b"\x00" * 15
    assert schools._image_size(ico) == 256


def test_host_parsing():
    assert schools.host_from_input("https://LMS.cofc.edu/d2l/home?x=1") == "lms.cofc.edu"
    assert schools.host_from_input("lms.cofc.edu") == "lms.cofc.edu"
    assert schools.host_from_input("http://127.0.0.1") is None
    assert schools.host_from_input("") is None
    assert asyncio.run(asyncio.to_thread(schools._public_host, "localhost")) is False


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
