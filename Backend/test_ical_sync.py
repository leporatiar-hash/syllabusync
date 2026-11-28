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
  - existing courses: reused (no duplicate), the LMS's other classes are created, events assigned
  - syncing twice (and connect + sync): no duplicate courses or deadlines
  - LMS as source of truth: moved due dates update, upcoming items removed from the feed are
    removed (past/completed kept), an empty feed or a second feed never deletes anything
  - syllabus deadlines in an LMS course give way to the LMS (exams on LMS-free dates stay)
  - link health: a dead link (404 / sign-in page) is "broken" on the first failure, a 500 only on
    the second; a good sync clears it; reconnecting replaces the broken feed
  - LOCATION identity extraction and name cleaning
"""
import os
from datetime import datetime, timedelta
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
    def __init__(self, body, status=200):
        self.status_code = status
        self.text = body


class _FakeClient:
    """Stands in for httpx.Client in main: every GET returns the fixture feed."""
    feed = build_feed()
    status = 200
    raise_network = False

    def __init__(self, *args, **kwargs):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def get(self, url, **kwargs):
        if _FakeClient.raise_network:
            raise main.httpx.ConnectError("nodename nor servname provided")
        return _FakeResponse(_FakeClient.feed, _FakeClient.status)


main.httpx.Client = _FakeClient

# Enforce foreign keys like Postgres does in production (SQLite ignores them by default, which is
# how a sync that failed on every Postgres run passed here).
from sqlalchemy import event as _sa_event  # noqa: E402


@_sa_event.listens_for(main.engine, "connect")
def _sqlite_fks_on(dbapi_conn, _record):
    dbapi_conn.execute("PRAGMA foreign_keys=ON")


main.engine.dispose()


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


def test_existing_courses_reused_and_rest_created():
    user_id, _ = make_user("existing", course_codes=["FINC 400"])
    synced, errors = run_sync(user_id)
    courses, assigned, n = snapshot(user_id)

    check("existing user: no errors", errors == [], str(errors))
    check("existing user: FINC 400 reused, the LMS's other classes created",
          sorted(courses) == ["ARTH 103", "FINC 400", "FINC 418"], str(sorted(courses)))
    check("existing user: kept their own course name", courses["FINC 400"].name == "FINC 400 course")
    check("existing user: events assigned by LOCATION",
          assigned["2001"] == assigned["2002"] == "FINC 400" and assigned["2005"] == "FINC 418"
          and assigned["2006"] == "ARTH 103", str(assigned))
    check("existing user: institution-wide events stay NULL", assigned["2007"] is None and assigned["2008"] is None, str(assigned))
    check("existing user: all events stored", n == 8, f"stored={n}")


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


def test_course_codes_written_differently_are_reused():
    """A course the student typed as "FINC400" (or created from a syllabus) is the same class."""
    user_id, _ = make_user("codes", course_codes=["FINC400", "Arth-103"])
    run_sync(user_id)
    courses, assigned, _ = snapshot(user_id)
    check("differently-written codes reused", sorted(courses) == ["Arth-103", "FINC 418", "FINC400"], str(sorted(courses)))
    check("events land in the reused courses", assigned["2001"] == "FINC400" and assigned["2006"] == "Arth-103", str(assigned))


def _stored(user_id, uid):
    db = main.SessionLocal()
    try:
        d = db.query(main.Deadline).filter(main.Deadline.user_id == user_id, main.Deadline.external_id.like(f"%{uid}%")).first()
        return (d.date, d.time) if d else None
    finally:
        db.close()


def test_utc_times_stored_local():
    # D2L/OAKS sends 11:59 PM EDT as 03:59Z the next day; it must be stored as the local date + time.
    user_id, _ = make_user("tz-default")
    run_sync(user_id)
    check("UTC 03:59Z on 10/08 stored as 10/07 11:59 PM Eastern", _stored(user_id, "2002") == ("2026-10-07", "11:59 PM"), str(_stored(user_id, "2002")))
    check("04:00Z rolls back to midnight local", _stored(user_id, "2007") == ("2010-09-12", "12:00 AM"), str(_stored(user_id, "2007")))

    # A phone that registered a different timezone wins over the Eastern default.
    user2, _ = make_user("tz-phone")
    db = main.SessionLocal()
    try:
        db.add(main.PushToken(token=f"ExponentPushToken[{user2[:12]}]", user_id=user2, timezone="America/Los_Angeles"))
        db.commit()
    finally:
        db.close()
    run_sync(user2)
    check("phone timezone used when known", _stored(user2, "2002") == ("2026-10-07", "8:59 PM"), str(_stored(user2, "2002")))

    # The timezone the student's device reports (app or website) wins over everything else:
    # a Central-time student's 11:59 PM CDT (04:59Z next day) must stay on the same day.
    user3, _ = make_user("tz-device")
    db = main.SessionLocal()
    try:
        db.add(main.PushToken(token=f"ExponentPushToken[{user3[:12]}]", user_id=user3, timezone="America/Los_Angeles"))
        prof = db.query(main.UserProfile).filter(main.UserProfile.user_id == user3).first()
        if prof is None:
            prof = main.UserProfile(user_id=user3, email=f"{user3}@example.edu")
            db.add(prof)
        prof.timezone = "America/Chicago"
        db.commit()
    finally:
        db.close()
    run_sync(user3)
    check("device timezone beats push-token timezone", _stored(user3, "2002") == ("2026-10-07", "10:59 PM"), str(_stored(user3, "2002")))


def _utc_stamp(days_from_now: int) -> str:
    """An iCal UTC timestamp N days out at 03:59Z (11:59 PM Eastern the night before)."""
    return (datetime.utcnow() + timedelta(days=days_from_now)).strftime("%Y%m%dT035900Z")


def _local_date(days_from_now: int) -> str:
    """The Eastern calendar date of _utc_stamp(days_from_now) (the suite's default timezone)."""
    from datetime import datetime as _dt
    stamp = _utc_stamp(days_from_now)
    utc = _dt.strptime(stamp, "%Y%m%dT%H%M%SZ").replace(tzinfo=main.ZoneInfo("UTC"))
    return utc.astimezone(main.ZoneInfo("America/New_York")).strftime("%Y-%m-%d")


def _set_feed(events):
    _FakeClient.feed = build_feed(events)


def _deadline(user_id, uid):
    db = main.SessionLocal()
    try:
        return db.query(main.Deadline).filter(main.Deadline.user_id == user_id, main.Deadline.external_id.like(f"%-{uid}@%")).first()
    finally:
        db.close()


def test_lms_changes_flow_through():
    user_id, _ = make_user("truth")
    future = _utc_stamp(10)  # always in the future, whatever day the suite runs
    events = [
        _event("3001", "Problem Set 5 - Due", "LOCATION:2026 Fall Investment Analysis (FINC-400-02)", dtstart=future),
        _event("3002", "Old Quiz - Due", "LOCATION:2026 Fall Investment Analysis (FINC-400-02)", dtstart="20260901T035900Z"),
        _event("3003", "Draft - Due", "LOCATION:2026 Fall Investment Analysis (FINC-400-02)", dtstart=future),
        _event("3004", "Done already - Due", "LOCATION:2026 Fall Investment Analysis (FINC-400-02)", dtstart=future),
    ]
    _set_feed(events)
    try:
        run_sync(user_id)
        db = main.SessionLocal()
        try:
            db.query(main.Deadline).filter(main.Deadline.external_id.like("%-3004@%")).update({"completed": True}, synchronize_session=False)
            db.commit()
        finally:
            db.close()

        # Professor moves Problem Set 5, deletes Draft and Done already, and the past quiz ages out
        moved = _event("3001", "Problem Set 5 (extended) - Due", "LOCATION:2026 Fall Investment Analysis (FINC-400-02)", dtstart=_utc_stamp(14))
        _set_feed([moved])
        # Default: an item missing from the feed is NOT deleted (feeds can omit real items)
        run_sync(user_id)
        check("missing item kept unless deletion mirroring is on", _deadline(user_id, "3003") is not None)
        os.environ["LMS_MIRROR_DELETIONS"] = "1"
        run_sync(user_id)
        os.environ.pop("LMS_MIRROR_DELETIONS", None)
        ps5 = _deadline(user_id, "3001")
        check("moved due date updates", ps5 and ps5.title == "Problem Set 5 (extended)" and ps5.date == _local_date(14),
              str(ps5 and (ps5.date, ps5.title)))
        check("upcoming item removed from the LMS is removed", _deadline(user_id, "3003") is None)
        check("past item is kept as history", _deadline(user_id, "3002") is not None)
        check("completed item is kept", _deadline(user_id, "3004") is not None)

        # A feed that comes back empty must not wipe anything
        _set_feed([])
        run_sync(user_id)
        check("empty feed deletes nothing", _deadline(user_id, "3001") is not None)

        # With a second iCal feed connected, items missing from one feed aren't removed
        db = main.SessionLocal()
        try:
            db.add(main.LMSConnection(user_id=user_id, provider="ical", ical_url=FEED_URL + "&second=1"))
            db.commit()
            conn = db.query(main.LMSConnection).filter_by(user_id=user_id, provider="ical").first()
            _set_feed([_event("3999", "Other feed item", "LOCATION:2026 Fall Investment Analysis (FINC-400-02)", dtstart=future)])
            main.sync_ical(conn, user_id, db)
        finally:
            db.close()
        check("second feed connected: nothing removed", _deadline(user_id, "3001") is not None)
    finally:
        _set_feed(FIXTURE_EVENTS)


def test_syllabus_deadlines_give_way_to_lms():
    """Syllabus uploaded first, LMS connected later: LMS dates replace the syllabus's, except
    syllabus exams on a date the LMS has nothing for that course."""
    user_id, _ = make_user("syl-first", course_codes=["FINC 400"])
    db = main.SessionLocal()
    try:
        course = db.query(main.Course).filter_by(user_id=user_id).first()
        for title, day, typ, done in (
            ("Homework 3", "2026-11-06", "assignment", False),      # LMS has it: replaced
            ("Midterm Exam", "2026-11-12", "exam", False),           # LMS silent that day: kept
            ("Final Exam", "2026-11-19", "exam", False),             # LMS has an item that day: replaced
            ("Reading 1", "2026-11-02", "reading", True),            # completed: kept
        ):
            db.add(main.Deadline(user_id=user_id, course_id=course.id, title=title, date=day, type=typ,
                                 source="syllabus", completed=done))
        db.add(main.Deadline(user_id=user_id, course_id=course.id, title="My study group", date="2026-11-06",
                             type="assignment", source="manual"))
        db.commit()
    finally:
        db.close()
    _set_feed([
        _event("4001", "Homework 3 - Due", "LOCATION:2026 Fall Investment Analysis (FINC-400-02)", dtstart="20261107T045900Z"),
        _event("4002", "Final Exam - Available", "LOCATION:2026 Fall Investment Analysis (FINC-400-02)", dtstart="20261120T045900Z"),
    ])
    try:
        run_sync(user_id)
    finally:
        _set_feed(FIXTURE_EVENTS)
    db = main.SessionLocal()
    try:
        rows = db.query(main.Deadline).filter_by(user_id=user_id).all()
        left = sorted((d.source, d.title) for d in rows)
    finally:
        db.close()
    check("syllabus copies replaced, LMS-free exam + completed + manual kept",
          left == sorted([("ical", "Homework 3"), ("ical", "Final Exam"), ("syllabus", "Midterm Exam"),
                          ("syllabus", "Reading 1"), ("manual", "My study group")]), str(left))


def test_lms_titles_and_opens():
    """D2L suffixes are stripped; a quiz's "Available" (opens) event isn't a deadline when the
    quiz also has a close/due event; an exam keeps its start as "(opens)"; types are inferred."""
    user_id, _ = make_user("titles")
    loc = "LOCATION:2026 Fall Investment Analysis (FINC-400-02)"
    _set_feed([
        _event("6001", "Quiz 3 - Available", loc, dtstart=_utc_stamp(2)),
        _event("6002", "Quiz 3 - Availability Ends", loc, dtstart=_utc_stamp(5)),
        _event("6003", "Midterm Exam - Available", loc, dtstart=_utc_stamp(8)),
        _event("6004", "Midterm Exam - Availability Ends", loc, dtstart=_utc_stamp(8)),
        _event("6005", "Final Exam - Available", loc, dtstart=_utc_stamp(20)),
        _event("6006", "Group Project - Due", loc, dtstart=_utc_stamp(10)),
    ])
    try:
        run_sync(user_id)
        q_open, q_end = _deadline(user_id, "6001"), _deadline(user_id, "6002")
        check("quiz 'opens' event not saved", q_open is None, str(q_open and q_open.title))
        check("quiz close saved as plain title, type Quiz", q_end and (q_end.title, q_end.type) == ("Quiz 3", "Quiz"), str(q_end and (q_end.title, q_end.type)))
        m_open = _deadline(user_id, "6003")
        check("exam start kept as '(opens)'", m_open and (m_open.title, m_open.type) == ("Midterm Exam (opens)", "Exam"), str(m_open and (m_open.title, m_open.type)))
        f = _deadline(user_id, "6005")
        check("exam with only a start kept by name", f and f.title == "Final Exam", str(f and f.title))
        p = _deadline(user_id, "6006")
        check("project typed", p and (p.title, p.type) == ("Group Project", "Project"), str(p and (p.title, p.type)))
    finally:
        _set_feed(FIXTURE_EVENTS)


def test_old_opens_rows_removed():
    """A quiz 'Available' row saved by an older sync is removed once the quiz also has a close event."""
    user_id, _ = make_user("old-opens")
    loc = "LOCATION:2026 Fall Investment Analysis (FINC-400-02)"
    db = main.SessionLocal()
    try:
        db.add(main.Deadline(user_id=user_id, date="2026-12-01", time="9:00 AM", type="assignment",
                             title="Quiz 4 - Available", source="ical", external_id="ical_1000-7001@lms.example.edu"))
        db.commit()
    finally:
        db.close()
    _set_feed([_event("7001", "Quiz 4 - Available", loc, dtstart=_utc_stamp(3)),
               _event("7002", "Quiz 4 - Availability Ends", loc, dtstart=_utc_stamp(4))])
    try:
        run_sync(user_id)
        check("stale quiz 'opens' row removed", _deadline(user_id, "7001") is None)
    finally:
        _set_feed(FIXTURE_EVENTS)


def _status(headers):
    return [c["status"] for c in client.get("/lms/connections", headers=headers).json()]


def test_dead_link_detected_and_replaced():
    user_id, headers = make_user("health")
    run_sync(user_id)
    check("healthy after a good sync", _status(headers) == ["ok"], str(_status(headers)))
    try:
        _FakeClient.status = 500
        run_sync(user_id)
        check("one 500 is not enough", _status(headers) == ["ok"], str(_status(headers)))
        run_sync(user_id)
        check("two failures in a row: broken", _status(headers) == ["broken"], str(_status(headers)))
        _FakeClient.status = 200
        run_sync(user_id)
        check("a good sync clears it", _status(headers) == ["ok"], str(_status(headers)))

        # Network failures (our outage, DNS, timeouts) never mark the student's link broken
        _FakeClient.raise_network = True
        for _ in range(5):
            run_sync(user_id)
        _FakeClient.raise_network = False
        check("network errors don't count as a dead link", _status(headers) == ["ok"], str(_status(headers)))

        _FakeClient.status = 404
        run_sync(user_id)
        check("dead link (404): broken at once", _status(headers) == ["broken"], str(_status(headers)))
        _FakeClient.status = 200
        _FakeClient.feed = "<html>Sign in</html>"
        run_sync(user_id)
        check("sign-in page instead of a calendar: still broken", _status(headers) == ["broken"], str(_status(headers)))
    finally:
        _FakeClient.status = 200
        _set_feed(FIXTURE_EVENTS)
    _, _, before = snapshot(user_id)
    r = client.post("/lms/connect/ical", json={"ical_url": FEED_URL + "&new=1"}, headers=headers)
    check("reconnect succeeds", r.status_code == 200, r.text[:200])
    _, _, after = snapshot(user_id)
    check("reconnect replaces the broken feed", _status(headers) == ["ok"], str(_status(headers)))
    check("deadlines carry over, no duplicates", before == after == 8, f"{before} -> {after}")


def test_change_alerts_recorded():
    user_id, _ = make_user("changes")
    loc = "LOCATION:2026 Fall Investment Analysis (FINC-400-02)"
    _set_feed([_event("5001", "Essay - Due", loc, dtstart=_utc_stamp(6)),
               _event("5002", "Far Project - Due", loc, dtstart=_utc_stamp(40))])
    try:
        run_sync(user_id)

        def rows():
            db = main.SessionLocal()
            try:
                return [(r.kind, r.old_date is not None) for r in db.query(main.DeadlineChange).filter_by(user_id=user_id).all()]
            finally:
                db.close()

        check("first sync: nothing is news", rows() == [], str(rows()))
        # Professor moves the essay earlier, pushes the far project further out, and posts a quiz
        _set_feed([_event("5001", "Essay - Due", loc, dtstart=_utc_stamp(3)),
                   _event("5002", "Far Project - Due", loc, dtstart=_utc_stamp(45)),
                   _event("5003", "Quiz 2 - Due", loc, dtstart=_utc_stamp(4))])
        run_sync(user_id)
        check("moved essay + new quiz recorded; far-off move ignored",
              sorted(rows()) == [("added", False), ("moved", True)], str(rows()))
        run_sync(user_id)
        check("unchanged resync records nothing new", len(rows()) == 2, str(rows()))
    finally:
        _set_feed(FIXTURE_EVENTS)


def test_feed_timezone_used_when_device_unknown():
    """A Central-time school's 11:59 PM deadline must land on the right day even before the
    student's phone has reported a timezone: the feed's X-WR-TIMEZONE is used."""
    user_id, _ = make_user("tz-feed")
    db = main.SessionLocal()
    try:
        db.add(main.UserProfile(user_id=user_id, email=f"{user_id}@example.com"))
        db.commit()
    finally:
        db.close()
    # 2026-10-08 04:59 UTC == Wed 10/07 11:59 PM in Chicago (CDT); in New York it would be 12:59 AM Thu.
    _FakeClient.feed = build_feed([_event("8001", "Lab 4 - Due", "LOCATION:2026 Fall Chemistry (CHEM-111-01)",
                                          dtstart="20261008T045900Z")]).replace(
        "X-WR-CALNAME", "X-WR-TIMEZONE:America/Chicago\r\nX-WR-CALNAME")
    try:
        run_sync(user_id)
    finally:
        _set_feed(FIXTURE_EVENTS)
    d = _deadline(user_id, "8001")
    check("feed timezone: due Wed 10/07 at 11:59 PM", (d.date, d.time) == ("2026-10-07", "11:59 PM"), f"{d.date} {d.time}")
    db = main.SessionLocal()
    try:
        tz = db.query(main.UserProfile).filter_by(user_id=user_id).first().timezone
    finally:
        db.close()
    check("feed timezone saved on the profile", tz == "America/Chicago", str(tz))


def test_device_timezone_beats_feed_timezone():
    user_id, _ = make_user("tz-device")
    db = main.SessionLocal()
    try:
        db.add(main.UserProfile(user_id=user_id, email=f"{user_id}@example.com", timezone="America/Los_Angeles"))
        db.commit()
    finally:
        db.close()
    _FakeClient.feed = build_feed([_event("8002", "Lab 5 - Due", "LOCATION:2026 Fall Chemistry (CHEM-111-01)",
                                          dtstart="20261008T045900Z")]).replace(
        "X-WR-CALNAME", "X-WR-TIMEZONE:America/Chicago\r\nX-WR-CALNAME")
    try:
        run_sync(user_id)
    finally:
        _set_feed(FIXTURE_EVENTS)
    d = _deadline(user_id, "8002")
    check("device timezone wins over the feed's", (d.date, d.time) == ("2026-10-07", "9:59 PM"), f"{d.date} {d.time}")


def test_syllabus_items_the_lms_lacks_are_kept():
    """A professor who posts one quiz to the LMS but keeps papers in the syllabus: the papers must
    survive (they used to be deleted as soon as the LMS covered the course)."""
    user_id, _ = make_user("syl-keep", course_codes=["ENGL 110"])
    db = main.SessionLocal()
    try:
        course = db.query(main.Course).filter_by(user_id=user_id).first()
        for title, day in (("Research Paper", "2026-11-20"), ("Homework 4", "2026-11-13"), ("Quiz 1", "2026-11-05")):
            db.add(main.Deadline(user_id=user_id, course_id=course.id, title=title, date=day, type="assignment", source="syllabus"))
        db.commit()
    finally:
        db.close()
    _set_feed([
        _event("8101", "Quiz 1 - Due", "LOCATION:2026 Fall Composition (ENGL-110-01)", dtstart="20261106T045900Z"),
        _event("8102", "Homework 3 - Due", "LOCATION:2026 Fall Composition (ENGL-110-01)", dtstart="20261107T045900Z"),
    ])
    try:
        run_sync(user_id)
    finally:
        _set_feed(FIXTURE_EVENTS)
    db = main.SessionLocal()
    try:
        left = sorted((d.source, d.title) for d in db.query(main.Deadline).filter_by(user_id=user_id).all())
    finally:
        db.close()
    check("only the syllabus copy of Quiz 1 is replaced",
          left == sorted([("ical", "Quiz 1"), ("ical", "Homework 3"), ("syllabus", "Research Paper"), ("syllabus", "Homework 4")]), str(left))


def test_timezone_inferred_from_due_times():
    """No timezone in the feed (Canvas-style): five assignments due at 06:59 UTC = 11:59 PM Pacific."""
    user_id, _ = make_user("tz-infer")
    db = main.SessionLocal()
    try:
        db.add(main.UserProfile(user_id=user_id, email=f"{user_id}@example.com"))
        db.commit()
    finally:
        db.close()
    _set_feed([_event(f"83{i}", f"Essay {i} - Due", "LOCATION:2026 Fall Communication (COMM-100-01)",
                      dtstart=f"202611{10 + i}T075900Z") for i in range(5)])
    try:
        run_sync(user_id)
    finally:
        _set_feed(FIXTURE_EVENTS)
    d = _deadline(user_id, "830")
    check("inferred Pacific: Essay 0 due Mon 11/9 at 11:59 PM", (d.date, d.time) == ("2026-11-09", "11:59 PM"), f"{d.date} {d.time}")


def test_saved_opens_row_removed_with_its_calendar_entry():
    """Same cleanup when the student had saved that 'opens' row to their calendar: the saved entry
    goes first, and the sync completes (in production it failed and rolled back every time)."""
    user_id, _ = make_user("old-opens-saved")
    loc = "LOCATION:2026 Fall Investment Analysis (FINC-400-02)"
    db = main.SessionLocal()
    try:
        d = main.Deadline(user_id=user_id, date="2026-12-01", time="9:00 AM", type="assignment",
                          title="Quiz 5 - Available", source="ical", external_id="ical_1000-7101@lms.example.edu")
        db.add(d)
        db.commit()
        db.add(main.CalendarEntry(deadline_id=d.id, user_id=user_id))
        db.commit()
    finally:
        db.close()
    _set_feed([_event("7101", "Quiz 5 - Available", loc, dtstart=_utc_stamp(3)),
               _event("7102", "Quiz 5 - Availability Ends", loc, dtstart=_utc_stamp(4))])
    try:
        synced, errors = run_sync(user_id)
        check("sync with a saved 'opens' row has no errors", not errors, str(errors))
        check("saved 'opens' row removed", _deadline(user_id, "7101") is None)
        check("its close event synced", _deadline(user_id, "7102") is not None)
        db = main.SessionLocal()
        try:
            conn = db.query(main.LMSConnection).filter_by(user_id=user_id).first()
            check("connection marked synced", conn.last_synced is not None and not (conn.last_error or ""), str(conn.last_error))
        finally:
            db.close()
    finally:
        _set_feed(FIXTURE_EVENTS)


if __name__ == "__main__":
    try:
        main.Base.metadata.create_all(bind=main.engine)
        test_identity_extraction()
        test_zero_courses_bulk_create()
        test_existing_courses_reused_and_rest_created()
        test_sync_twice_no_duplicates()
        test_connect_endpoint_then_background_sync()
        test_course_codes_written_differently_are_reused()
        test_utc_times_stored_local()
        test_lms_changes_flow_through()
        test_syllabus_deadlines_give_way_to_lms()
        test_dead_link_detected_and_replaced()
        test_change_alerts_recorded()
        test_lms_titles_and_opens()
        test_old_opens_rows_removed()
        test_saved_opens_row_removed_with_its_calendar_entry()
        test_feed_timezone_used_when_device_unknown()
        test_device_timezone_beats_feed_timezone()
        test_syllabus_items_the_lms_lacks_are_kept()
        test_timezone_inferred_from_due_times()
        print("\nAll iCal sync tests passed.")
    finally:
        try:
            os.remove(_DB_PATH)
        except OSError:
            pass
