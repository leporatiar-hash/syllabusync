#!/usr/bin/env python3
"""
Tests for syllabus uploads when the student's LMS is connected (the LMS owns due dates).

No pytest in this project -- run directly: `python3 test_syllabus_lms.py`. Uses a throwaway SQLite
DB and stubs the AI extraction, so nothing leaves the machine.

Covers:
  - /upload attaches to the LMS-created course (no duplicate course), keeps the LMS name, stores
    the syllabus text + course info, and only adds exams the LMS doesn't have
  - /upload for a class with no LMS course still creates the course and all its deadlines
  - /courses/{id}/syllabus on an LMS course: same rule
  - deleting a syllabus keeps the LMS deadlines
  - syllabus deadlines are tagged source="syllabus"
"""
import os
import tempfile
import uuid

_DB_FD, _DB_PATH = tempfile.mkstemp(suffix=".db")
os.close(_DB_FD)
os.environ["OPENAI_API_KEY"] = "sk-test"
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_PATH}"
os.environ["JWT_SECRET"] = "test-jwt-secret-for-syllabus-lms"
os.environ.pop("RESEND_API_KEY", None)

from starlette.testclient import TestClient  # noqa: E402

import main  # noqa: E402

client = TestClient(main.app)

SYLLABUS = {"meta": {}, "deadlines": []}


async def fake_text(content):
    return "x" * 200


async def fake_meta(text):
    return SYLLABUS["meta"]


async def fake_deadlines(text, metadata, naming_style="simple"):
    return SYLLABUS["deadlines"]


main.extract_pdf_text_for_syllabus = fake_text
main.extract_course_metadata = fake_meta
main.extract_deadlines_with_context = fake_deadlines


def _user():
    email = f"syl-{uuid.uuid4().hex[:8]}@example.edu"
    ip = f"198.19.{uuid.uuid4().int % 250}.{uuid.uuid4().int % 250 + 1}"
    r = client.post("/auth/register", json={"email": email, "password": "password123"}, headers={"X-Real-IP": ip})
    assert r.status_code == 200, r.text
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    return client.get("/me", headers=h).json()["user_id"], h


def _lms_course(user_id, code="FINC 418", name="Adv Valuation & Corp Finc Anal"):
    """What an OAKS connect leaves behind: a course with no semester and iCal deadlines."""
    db = main.SessionLocal()
    try:
        c = main.Course(user_id=user_id, name=name, code=code)
        db.add(c)
        db.flush()
        for i, day in enumerate(("2026-11-03", "2026-11-17")):
            db.add(main.Deadline(user_id=user_id, course_id=c.id, title=f"Case {i + 1} - Due", date=day,
                                 type="assignment", source="ical", external_id=f"ical_{uuid.uuid4().hex}"))
        db.commit()
        return c.id
    finally:
        db.close()


def _rows(user_id):
    db = main.SessionLocal()
    try:
        courses = db.query(main.Course).filter_by(user_id=user_id).all()
        deadlines = db.query(main.Deadline).filter_by(user_id=user_id).all()
        return courses, sorted((d.source, d.title, d.date) for d in deadlines)
    finally:
        db.close()


def _syllabus(code_name, deadlines, semester="Fall 2026"):
    SYLLABUS["meta"] = {"course_name": code_name, "semester": semester,
                        "course_info": {"instructor": {"name": "Dr. Smith", "email": "smith@cofc.edu"}}}
    SYLLABUS["deadlines"] = deadlines


DL = [
    {"title": "Case 1", "date": "2026-11-03", "type": "assignment"},
    {"title": "Midterm Exam", "date": "2026-11-10", "type": "exam"},
    {"title": "Final Exam", "date": "2026-11-17", "type": "exam"},  # LMS has something that day
    {"title": "Weekly reading", "date": "2026-11-04", "type": "reading", "recurring": True},
]


def _upload(h, path="/upload"):
    return client.post(path, files={"file": ("syllabus.pdf", b"%PDF-1.4 test", "application/pdf")}, headers=h)


def test_upload_joins_lms_course():
    uid, h = _user()
    cid = _lms_course(uid)
    _syllabus("FINC 418 - Advanced Valuation and Corporate Financial Analysis", DL)
    r = _upload(h)
    assert r.status_code == 200, r.text
    body = r.json()
    courses, rows = _rows(uid)
    assert len(courses) == 1 and courses[0].id == cid == body["course"]["id"], [c.code for c in courses]
    assert body["lms_backed"] is True and body["deadlines_added"] == 1, body
    c = courses[0]
    assert c.name == "Adv Valuation & Corp Finc Anal", c.name  # LMS name kept
    assert c.semester == "Fall 2026" and c.syllabus_text and c.course_info, (c.semester, c.course_info)
    assert rows == sorted([("ical", "Case 1 - Due", "2026-11-03"), ("ical", "Case 2 - Due", "2026-11-17"),
                           ("syllabus", "Midterm Exam", "2026-11-10")]), rows


def test_upload_without_lms_course_creates_everything():
    uid, h = _user()
    _lms_course(uid)
    _syllabus("ARTH 103 - Asian Art", DL)
    r = _upload(h)
    assert r.status_code == 200 and r.json()["lms_backed"] is False, r.text
    courses, rows = _rows(uid)
    assert sorted(c.code for c in courses) == ["ARTH 103", "FINC 418"], [c.code for c in courses]
    assert len([x for x in rows if x[0] == "syllabus"]) == 4, rows


def test_course_syllabus_endpoint_and_delete():
    uid, h = _user()
    cid = _lms_course(uid)
    _syllabus("FINC 418 - Advanced Valuation", DL)
    r = _upload(h, f"/courses/{cid}/syllabus")
    assert r.status_code == 200, r.text
    assert r.json()["lms_backed"] is True and r.json()["deadlines_added"] == 1, r.json()
    r = client.delete(f"/courses/{cid}/syllabus", headers=h)
    assert r.status_code == 200, r.text
    _, rows = _rows(uid)
    assert rows == sorted([("ical", "Case 1 - Due", "2026-11-03"), ("ical", "Case 2 - Due", "2026-11-17")]), rows


def test_different_class_same_name_not_merged():
    uid, h = _user()
    _lms_course(uid, code="FINC 400", name="Investment Analysis")
    _syllabus("FINC 401 - Investment Analysis II", DL[:1])
    r = _upload(h)
    assert r.status_code == 200 and r.json()["lms_backed"] is False, r.text
    courses, _ = _rows(uid)
    assert sorted(c.code for c in courses) == ["FINC 400", "FINC 401"], [c.code for c in courses]


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
