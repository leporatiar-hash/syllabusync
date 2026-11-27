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


_REAL_DETECT = schools.detect  # kept for tests that stub the network one level lower
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


def _row(name, domain):
    return {"name": name, "domain": domain}


def test_canvas_pick_avoids_subunits():
    # Real rows from Canvas's directory (Nov 2026) that the old "first name containing it" rule got wrong.
    ucla = [_row("UCLA Extension (University of California, Los Angeles)", "my.uclaextension.edu"), _row("UCLA", "bruinlearn.ucla.edu")]
    assert schools.pick_canvas(ucla, "University of California, Los Angeles", "ucla.edu", None, None) == ("bruinlearn.ucla.edu", "canvas_search")
    # Only the Extension entry known: not good enough on its own.
    assert schools.pick_canvas(ucla[:1], "University of California, Los Angeles", "ucla.edu", None, None) is None

    ut = [
        _row("Meadows Center and Vaughn Gross Center at The University of Texas at Austin", "nationaldeafcenter.instructure.com"),
        _row("The University of Texas at Austin High School - Parents/Observers", "uths.instructure.com"),
        _row("University Of Texas at Austin", "utexas.instructure.com"),
    ]
    assert schools.pick_canvas(ut, "The University of Texas at Austin", "utexas.edu", None, None)[0] == "utexas.instructure.com"

    um = [
        _row("University of Michigan - Center of Academic Innovation", "courses.online.umich.edu"),
        _row("University of Michigan - Flint", "canvas.flint.umich.edu"),
        _row("University of Michigan Ann Arbor Catalog", "u-m-canvas.it.umich.edu"),
        _row("University of Michigan - Ann Arbor", "m.canvas.umich.edu"),
    ]
    assert schools.pick_canvas(um, "University of Michigan - Ann Arbor", "umich.edu", None, None)[0] == "m.canvas.umich.edu"

    assert schools.pick_canvas([_row("UC Berkeley - Extension", "onlinelearning.berkeley.edu"), _row("UC Berkeley", "bcourses.berkeley.edu")],
                               "University of California, Berkeley", "berkeley.edu", None, None)[0] == "bcourses.berkeley.edu"
    assert schools.pick_canvas([_row("University of Virginia (UVA)", "canvas.its.virginia.edu")],
                               "University of Virginia, Charlottesville", "virginia.edu", None, None)[0] == "canvas.its.virginia.edu"


def test_canvas_pick_probes():
    # canvas.<domain> answering (after redirects) beats a weak directory match.
    assert schools.pick_canvas([], "University of California, Los Angeles", "ucla.edu", "bruinlearn.ucla.edu", None) == ("bruinlearn.ucla.edu", "probe")
    # A bare <root>.instructure.com is a last resort: never over a confirmed Brightspace site...
    assert schools.pick_canvas([], "University of Georgia", "uga.edu", None, "uga.instructure.com", brightspace_found=True) is None
    # ...but used when nothing else turned up, or when the directory backs it.
    assert schools.pick_canvas([], "Auburn University", "auburn.edu", None, "auburn.instructure.com") == ("auburn.instructure.com", "probe")
    assert schools.pick_canvas([_row("Auburn University", "auburn.instructure.com")], "Auburn University", "auburn.edu", None,
                               "auburn.instructure.com", brightspace_found=True)[0] == "auburn.instructure.com"


def _detect_with(bs=(), bb=(), canvas_rows=(), own=None, root=None, domain="sc.edu", name="University of South Carolina"):
    """Run the real detect() with every network probe stubbed."""
    saved = (schools._is_brightspace, schools._is_blackboard, schools._is_canvas, schools._canvas_directory, schools._public_host, schools._current_domain)

    async def is_bs(client, host):
        return host in bs

    async def is_bb(client, host):
        return host in bb

    async def is_cv(client, host, follow=False):
        return own if host.startswith("canvas.") else (root if host.endswith(".instructure.com") else None)

    async def directory(client, term):
        return list(canvas_rows)

    schools._is_brightspace, schools._is_blackboard, schools._is_canvas, schools._canvas_directory = is_bs, is_bb, is_cv, directory
    schools._public_host = lambda h: True

    async def no_move(d):
        return None

    schools._current_domain = no_move
    try:
        return [(o["provider"], o["host"]) for o in asyncio.run(_REAL_DETECT(domain, name))]
    finally:
        (schools._is_brightspace, schools._is_blackboard, schools._is_canvas, schools._canvas_directory,
         schools._public_host, schools._current_domain) = saved


def test_blackboard_detection():
    # Blackboard on the school's domain, and the hosted <root>learn.blackboard.com form (Alabama).
    assert _detect_with(bb={"blackboard.sc.edu"}) == [("blackboard", "blackboard.sc.edu")]
    assert _detect_with(bb={"ualearn.blackboard.com"}, domain="ua.edu", name="The University of Alabama") == [("blackboard", "ualearn.blackboard.com")]
    # Mid-migration schools: Canvas/Brightspace lead, Blackboard stays as the alternative.
    rows = [{"name": "University of South Carolina", "domain": "sc.instructure.com"}]
    assert _detect_with(bb={"blackboard.sc.edu"}, canvas_rows=rows) == [("canvas", "sc.instructure.com"), ("blackboard", "blackboard.sc.edu")]
    assert _detect_with(bs={"d2l.sc.edu"}, bb={"blackboard.sc.edu"})[0] == ("brightspace", "d2l.sc.edu")
    assert _detect_with() == []
    # An unlisted <root>.instructure.com never outranks a confirmed Blackboard (UT Dallas).
    assert _detect_with(bb={"utdallas.blackboard.com"}, root="utdallas.instructure.com", domain="utdallas.edu",
                        name="University of Texas at Dallas") == [("blackboard", "utdallas.blackboard.com")]


def test_state_system_hosts():
    assert schools._brightspace_candidates("bhsu.edu")[0] == "d2l.sdbor.edu"
    assert schools._brightspace_candidates("baruch.cuny.edu")[0] == "cuny.brightspace.com"
    assert "mnsu.learn.minnstate.edu" in schools._brightspace_candidates("mnsu.edu")
    assert schools._system_brightspace("ucla.edu") == []


def test_profile_saves_blackboard():
    h = _user()
    r = client.post("/me/profile", json={"school_domain": "sc.edu", "lms_provider": "blackboard", "lms_host": "blackboard.sc.edu"}, headers=h)
    assert r.status_code == 200, r.text
    p = client.get("/me", headers=h).json()["profile"]
    assert p["lms_provider"] == "blackboard" and p["lms_host"] == "blackboard.sc.edu", p


def test_device_timezone_saved():
    h = _user()
    client.post("/me/profile", json={"full_name": "TZ Tester"}, headers=h)
    r = client.post("/me/timezone", json={"timezone": "America/Chicago"}, headers=h)
    assert r.status_code == 200 and r.json()["saved"], r.text
    assert client.post("/me/timezone", json={"timezone": "America/Chicago"}, headers=h).json()["changed"] is False
    assert client.post("/me/timezone", json={"timezone": "Mars/Olympus"}, headers=h).status_code == 400


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
