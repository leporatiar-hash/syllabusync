#!/usr/bin/env python3
"""
Tests for iCal (OAKS / D2L Brightspace) course handling in sync_ical.

No pytest in this project -- run directly: `python3 test_ical_sync.py`
(matches test_notes.py). Uses a throwaway SQLite file DB, and replaces httpx.Client so
sync_ical / POST /lms/connect/ical read a fixture feed instead of the network.

The fixture mirrors a real OAKS feed (sanitized): the class is in LOCATION as
"2026 Fall <Name> (DEPT-NNN-SS)", Zoom meetings wrap it as "Zoom Online Meeting (...)",
SUMMARY on copied events names *other* terms and courses (e.g. FINC-316 on a FINC 418 event),
and institution-wide events use LOCATION "College of Charleston".

Covers:
  - zero courses: one course per real class, cleaned names, distinct palette colors, events
    assigned by LOCATION, no junk courses from SUMMARY / institution-wide / room events
  - existing courses: no courses created, matched events assigned, unmatched stay NULL
  - syncing twice (and connect + sync): no duplicate courses or deadlines
  - race guard: if courses appear before the bulk insert, it creates nothing
  - LOCATION identity extraction and name cleaning
"""
import os
import tempfile

# Env vars must be set before importing main -- it reads them at import time.
_DB_FD, _DB_PATH = tempfile.mkstemp(suffix=".db")
os.close(_DB_FD)
os.environ["OPENAI_API_KEY"] = "sk-test"
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_PATH}"
os.environ["JWT_SECRET"] = "test-jwt-secret-for-ical"
os.environ["STRIPE_SECRET_KEY"] = "sk_test_dummy"
os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_test_secret"

from starlette.testclient import TestClient  # noqa: E402

import main  # noqa: E402

client = TestClient(main.app)

FEED_URL = "https://lms.example.edu/d2l/le/calendar/feed/user/feed.ics?token=test"


def _event(uid, summary, location, dtstart="20261001T035900Z", description=None):
    lines = [
        "BEGIN:VEVENT",
        "DTSTAMP:20260928T030227Z",
        f"SUMMARY:{summary}",
        location,  # pre-formatted so tests can include D2L's folded lines
    ]
    if description:
        lines.append(f"DESCRIPTION:{description}")
    lines += [
        "CLASS:PUBLIC",
        f"DTSTART:{dtstart}",
        f"DTEND:{dtstart}",
        f"UID:1000-{uid}@lms.example.edu",
        "SEQUENCE:0",
        "LAST-MODIFIED:20260914T162027Z",
        "END:VEVENT",
    ]
    return lines


FIXTURE_EVENTS = [
    # FINC 400 — plain LOCATION, quiz + dropbox style events
    _event("2001", "Exam 2- Requires Respondus LockDown Browser - Available",
           "LOCATION:2026 Fall Investment Analysis (FINC-400-02)",
           description="Quizzes:\\nExam 2 - https://lms.example.edu/d2l/lms/quizzing/quizzing.d2l?ou=4001&qi=1"),
    _event("2002", "Homework 3 - Due",
           "LOCATION:2026 Fall Investment Analysis (FINC-400-02)", dtstart="20261008T035900Z"),
    # FINC 418 — Zoom-wrapped LOCATION, folded exactly like D2L folds it, with stale SUMMARYs
    # naming older offerings and a different course code (FINC-316)
    _event("2003", "2022 Fall Adv Valuation & Corp Finc Anal (FINC-418-01)",
           "LOCATION:Zoom Online Meeting (2026 Fall Adv Valuation & Corp Finc Anal (FIN\r\n\tC-418-01))",
           description="Click here to join Zoom Meeting"),
    _event("2004", "2022 Fall Advanced Financial Statement Analysis (FINC-316-01)",
           "LOCATION:Zoom Online Meeting (2026 Fall Adv Valuation & Corp Finc Anal (FIN\r\n\tC-418-01))"),
    _event("2005", "Case Study 1 - Due",
           "LOCATION:2026 Fall Adv Valuation & Corp Finc Anal (FINC-418-01)"),
    # ARTH 103
    _event("2006", "Museum Response Paper - Due",
           "LOCATION:2026 Fall Asian Art and Architecture (ARTH-103-01)"),
    # Institution-wide and non-course events: must never become courses
    _event("2007", "Planned IT Outage", "LOCATION:College of Charleston", dtstart="20100912T040000Z"),
    _event("2008", "Career Fair (BLDG 204)", "LOCATION:Room 204"),
]


def build_feed(events=FIXTURE_EVENTS) -> str:
    lines = [
        "BEGIN:VCALENDAR",
        "PRODID:-//D2L//NONSGML v1.0//EN",
        "VERSION:2.0",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:All Courses - Example College",
    ]
    for ev in events:
        lines += ev
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"


class _FakeResponse:
    def __init__(self, body):
        self.status_code = 200
        self.text = body


class _FakeClient:
    """Stands in for httpx.Client in main: every GET returns the fixture feed."""
    feed = build_feed()

    def __init__(self, *args, **kwargs):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def get(self, url, **kwargs):
        return _FakeResponse(_FakeClient.feed)


main.httpx.Client = _FakeClient


def check(name: str, condition: bool, detail: str = ""):
    status = "PASS" if condition else "FAIL"
    print(f"[{status}] {name}" + (f"  -> {detail}" if detail and not condition else ""))
    if not condition:
        raise AssertionError(f"{name} {detail}".strip())


def make_user(label: str, course_codes=()):
    """Create a user (optionally with courses); return (user_id, headers)."""
    db = main.SessionLocal()
    try:
        user = main.User(email=f"{label}-{main.generate_uuid()}@example.com")
        db.add(user)
        db.commit()
        for code in course_codes:
            db.add(main.Course(user_id=user.id, name=f"{code} course", code=code))
        db.commit()
        tokens = main._issue_tokens(user.id, user.email)
        return user.id, {"Authorization": f"Bearer {tokens['access_token']}"}
    finally:
        db.close()


def run_sync(user_id: str):
    db = main.SessionLocal()
    try:
        conn = db.query(main.LMSConnection).filter_by(user_id=user_id, provider="ical").first()
        if not conn:
            conn = main.LMSConnection(user_id=user_id, provider="ical", ical_url=FEED_URL)
            db.add(conn)
            db.commit()
        return main.sync_ical(conn, user_id, db)
    finally:
        db.close()


def snapshot(user_id: str):
    """Return (courses by code, {uid suffix: course code or None}, deadline count)."""
    db = main.SessionLocal()
    try:
        courses = db.query(main.Course).filter_by(user_id=user_id).all()
        by_id = {c.id: c for c in courses}
        deadlines = db.query(main.Deadline).filter_by(user_id=user_id, source="ical").all()
        assigned = {
            d.external_id.split("-")[1].split("@")[0]: (by_id[d.course_id].code if d.course_id else None)
            for d in deadlines
        }
        return {c.code: c for c in courses}, assigned, len(deadlines)
    finally:
        db.close()


def test_identity_extraction():
    ident = main._ical_course_identity
    check("plain D2L location", ident("2026 Fall Investment Analysis (FINC-400-02)") == ("FINC 400", "Investment Analysis"))
    check("zoom-wrapped location", ident("Zoom Online Meeting (2026 Fall Adv Valuation & Corp Finc Anal (FINC-418-01))")
          == ("FINC 418", "Adv Valuation & Corp Finc Anal"))
    check("code-first with trailing term", ident("FINC-303-01 Corporate Finance Fall 2026") == ("FINC 303", "Corporate Finance"))
    check("special-topics prefix kept", ident("2026 Fall ST: Launch X (ENTR-260-02)") == ("ENTR 260", "ST: Launch X"))
    check("institution-wide rejected", ident("College of Charleston") is None)
    check("room rejected", ident("Room 204") is None and ident("ROOM 204, Tate Center") is None)
    check("building + number rejected", ident("Maybank Hall 115") is None)
    check("empty rejected", ident("") is None)


def test_zero_courses_bulk_create():
    user_id, _ = make_user("fresh")
    synced, errors = run_sync(user_id)
    courses, assigned, n = snapshot(user_id)

    check("sync reported no errors", errors == [], str(errors))
    check("all 8 events synced", synced == 8 and n == 8, f"synced={synced} stored={n}")
    check("exactly the 3 real classes created", sorted(courses) == ["ARTH 103", "FINC 400", "FINC 418"], str(sorted(courses)))
    check("no junk course from a stale SUMMARY", "FINC 316" not in courses)
    check("names cleaned of term + section", courses["FINC 400"].name == "Investment Analysis"
          and courses["FINC 418"].name == "Adv Valuation & Corp Finc Anal"
          and courses["ARTH 103"].name == "Asian Art and Architecture",
          str({c: v.name for c, v in courses.items()}))
    colors = [c.color for c in courses.values()]
    check("colors distinct", len(set(colors)) == 3, str(colors))
    check("colors from palette in creation order",
          [courses[c].color for c in ("FINC 400", "FINC 418", "ARTH 103")] == main.COURSE_COLOR_PALETTE[:3], str(colors))
    check("events assigned by LOCATION",
          assigned["2001"] == assigned["2002"] == "FINC 400"
          and assigned["2003"] == assigned["2004"] == assigned["2005"] == "FINC 418"
          and assigned["2006"] == "ARTH 103", str(assigned))
    check("institution-wide + room events stay unassigned", assigned["2007"] is None and assigned["2008"] is None, str(assigned))


def test_existing_courses_no_create():
    user_id, _ = make_user("existing", course_codes=["FINC 400"])
    synced, errors = run_sync(user_id)
    courses, assigned, n = snapshot(user_id)

    check("existing user: no errors", errors == [], str(errors))
    check("existing user: no courses created", sorted(courses) == ["FINC 400"], str(sorted(courses)))
    check("existing user: matched events assigned", assigned["2001"] == assigned["2002"] == "FINC 400", str(assigned))
    check("existing user: unmatched events NULL (incl. SUMMARY naming FINC-316)",
          all(assigned[u] is None for u in ("2003", "2004", "2005", "2006", "2007", "2008")), str(assigned))
    check("existing user: all events still stored", n == 8, f"stored={n}")


def test_sync_twice_no_duplicates():
    user_id, _ = make_user("twice")
    run_sync(user_id)
    first_courses, first_assigned, first_n = snapshot(user_id)
    run_sync(user_id)
    courses, assigned, n = snapshot(user_id)

    check("second sync: same 3 courses", sorted(courses) == sorted(first_courses) and len(courses) == 3, str(sorted(courses)))
    check("second sync: same course ids", all(courses[c].id == first_courses[c].id for c in courses))
    check("second sync: no duplicate deadlines", n == first_n == 8, f"{first_n} -> {n}")
    check("second sync: assignments unchanged", assigned == first_assigned, str(assigned))


def test_connect_endpoint_then_background_sync():
    """Connect (which runs the initial sync) followed by a background-style sync of the same
    connection must not double-create anything."""
    user_id, headers = make_user("connect")
    resp = client.post("/lms/connect/ical", json={"ical_url": FEED_URL}, headers=headers)
    check("connect endpoint succeeds", resp.status_code == 200, f"{resp.status_code} {resp.text[:200]}")
    check("connect endpoint synced all events", resp.json()["initial_sync"]["synced_count"] == 8, resp.text[:200])
    run_sync(user_id)
    courses, _, n = snapshot(user_id)
    check("connect + sync: 3 courses, 8 deadlines", len(courses) == 3 and n == 8, f"courses={sorted(courses)} deadlines={n}")


def test_race_guard():
    """If courses appear between sync start and the bulk insert, bulk-create backs off."""
    user_id, _ = make_user("race", course_codes=["ARTH 103"])
    db = main.SessionLocal()
    try:
        from icalendar import Calendar
        events = [c for c in Calendar.from_ical(build_feed()).walk() if c.name == "VEVENT"]
        result = main._bulk_create_ical_courses(events, user_id, db)
        db.commit()
    finally:
        db.close()
    courses, _, _ = snapshot(user_id)
    check("race: bulk-create returns None when courses exist", result is None)
    check("race: nothing created", sorted(courses) == ["ARTH 103"], str(sorted(courses)))


if __name__ == "__main__":
    try:
        main.Base.metadata.create_all(bind=main.engine)
        test_identity_extraction()
        test_zero_courses_bulk_create()
        test_existing_courses_no_create()
        test_sync_twice_no_duplicates()
        test_connect_endpoint_then_background_sync()
        test_race_guard()
        print("\nAll iCal sync tests passed.")
    finally:
        try:
            os.remove(_DB_PATH)
        except OSError:
            pass
