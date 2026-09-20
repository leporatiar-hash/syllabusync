#!/usr/bin/env python3
"""
Tests for the per-course Notes feature (GET/POST /courses/{id}/notes,
GET/PATCH/DELETE /notes/{id}).

No pytest in this project -- run directly: `python3 test_notes.py`
(matches test_stripe_webhook.py / test_chunking.py). Uses a throwaway SQLite file DB
and FastAPI's bundled TestClient, with real native JWTs minted by main._issue_tokens
so the real auth dependency is exercised end to end.

Covers:
  - create / list / get / update / delete happy path, newest-edit-first ordering, previews
  - user isolation: a second user gets 404 (never 403 / never the data) on every route
    for the first user's course and notes, and cannot create notes in their course
  - unauthenticated requests get 401
  - size limits (title / content) and the per-course note cap
  - deleting a course deletes its notes; deleting an account deletes its notes
"""
import os
import tempfile
import time

# Env vars must be set before importing main -- it reads them at import time.
_DB_FD, _DB_PATH = tempfile.mkstemp(suffix=".db")
os.close(_DB_FD)
os.environ["OPENAI_API_KEY"] = "sk-test"
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_PATH}"
os.environ["JWT_SECRET"] = "test-jwt-secret-for-notes"
os.environ["STRIPE_SECRET_KEY"] = "sk_test_dummy"
os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_test_secret"

from starlette.testclient import TestClient  # noqa: E402

import main  # noqa: E402

# Not used as a context manager on purpose: that would run @app.on_event("startup"),
# which attempts a real network JWKS fetch.
client = TestClient(main.app)


def check(name: str, condition: bool):
    status = "PASS" if condition else "FAIL"
    print(f"[{status}] {name}")
    if not condition:
        raise AssertionError(name)


def make_user_and_course(label: str):
    """Create a user + one course directly in the DB; return (headers, course_id, user_id)."""
    db = main.SessionLocal()
    try:
        user = main.User(email=f"{label}-{main.generate_uuid()}@example.com")
        db.add(user)
        db.commit()
        course = main.Course(user_id=user.id, name=f"{label} course")
        db.add(course)
        db.commit()
        tokens = main._issue_tokens(user.id, user.email)
        return {"Authorization": f"Bearer {tokens['access_token']}"}, course.id, user.id
    finally:
        db.close()


def count_notes(**filters) -> int:
    db = main.SessionLocal()
    try:
        return db.query(main.Note).filter_by(**filters).count()
    finally:
        db.close()


def test_crud_happy_path():
    h, course_id, _ = make_user_and_course("alice")

    # Blank note (what the UI creates on "New note")
    r = client.post(f"/courses/{course_id}/notes", json={}, headers=h)
    check("create blank note -> 200", r.status_code == 200)
    blank = r.json()
    check("blank note has empty title/content", blank["title"] == "" and blank["content"] == "")
    check("note is tied to the course", blank["course_id"] == course_id)

    r = client.post(
        f"/courses/{course_id}/notes",
        json={"title": "  Week 1  ", "content": "Intro to\n\n  supply   and demand"},
        headers=h,
    )
    check("create note with content -> 200", r.status_code == 200)
    note = r.json()
    check("title is trimmed", note["title"] == "Week 1")
    check("content is stored verbatim", note["content"] == "Intro to\n\n  supply   and demand")

    r = client.get(f"/notes/{note['id']}", headers=h)
    check("get note -> 200 with full content", r.status_code == 200 and r.json()["content"] == note["content"])

    # Autosave-style partial updates
    time.sleep(0.01)
    r = client.patch(f"/notes/{note['id']}", json={"content": "updated body"}, headers=h)
    check("patch content -> 200", r.status_code == 200 and r.json()["content"] == "updated body")
    check("patch content leaves title alone", r.json()["title"] == "Week 1")
    check("updated_at moves forward on edit", r.json()["updated_at"] > note["updated_at"])
    r = client.patch(f"/notes/{note['id']}", json={"title": "Renamed"}, headers=h)
    check("patch title leaves content alone", r.json()["title"] == "Renamed" and r.json()["content"] == "updated body")
    r = client.patch(f"/notes/{note['id']}", json={"content": ""}, headers=h)
    check("content can be cleared to empty string", r.status_code == 200 and r.json()["content"] == "")
    r = client.patch(f"/notes/{note['id']}", json={}, headers=h)
    check("empty patch is a harmless no-op", r.status_code == 200 and r.json()["title"] == "Renamed")

    # List: most recently edited first, previews collapse whitespace and truncate
    long_body = ("word " * 100).strip()
    client.patch(f"/notes/{blank['id']}", json={"content": "Line one\n\n   line   two\n" + long_body}, headers=h)
    r = client.get(f"/courses/{course_id}/notes", headers=h)
    check("list -> 200", r.status_code == 200)
    listed = r.json()
    check("list has both notes", len(listed) == 2)
    check("list is newest-edit-first", listed[0]["id"] == blank["id"])
    check("preview collapses whitespace", listed[0]["preview"].startswith("Line one line two word"))
    check("preview is truncated to 120 chars", len(listed[0]["preview"]) <= 120)
    check("list rows do not carry the full content", "content" not in listed[0])

    r = client.delete(f"/notes/{note['id']}", headers=h)
    check("delete -> 200", r.status_code == 200)
    check("deleted note is gone (404)", client.get(f"/notes/{note['id']}", headers=h).status_code == 404)
    check("deleting again -> 404", client.delete(f"/notes/{note['id']}", headers=h).status_code == 404)
    check("list shrinks after delete", len(client.get(f"/courses/{course_id}/notes", headers=h).json()) == 1)


def test_user_isolation():
    ha, course_a, _ = make_user_and_course("alice")
    hb, course_b, _ = make_user_and_course("bob")

    secret = client.post(
        f"/courses/{course_a}/notes", json={"title": "Alice private", "content": "alice-secret"}, headers=ha
    ).json()

    # Bob cannot see, edit, or delete Alice's note -- and gets the same 404 as a nonexistent id
    for label, resp in [
        ("get", client.get(f"/notes/{secret['id']}", headers=hb)),
        ("patch", client.patch(f"/notes/{secret['id']}", json={"content": "pwned"}, headers=hb)),
        ("delete", client.delete(f"/notes/{secret['id']}", headers=hb)),
    ]:
        check(f"other user {label} on someone's note -> 404", resp.status_code == 404)
        check(f"other user {label} response leaks nothing", "alice-secret" not in resp.text)
    missing = client.get("/notes/does-not-exist", headers=hb)
    check("nonexistent id and foreign id look identical", missing.status_code == 404 and missing.json() == client.get(f"/notes/{secret['id']}", headers=hb).json())

    # Bob cannot list or create notes in Alice's course
    check("other user list on someone's course -> 404", client.get(f"/courses/{course_a}/notes", headers=hb).status_code == 404)
    r = client.post(f"/courses/{course_a}/notes", json={"content": "injected"}, headers=hb)
    check("other user create in someone's course -> 404", r.status_code == 404)
    check("nothing was injected into Alice's course", count_notes(course_id=course_a) == 1)

    # Bob's own course shows none of Alice's notes; Alice's note is untouched
    check("Bob's course list is empty", client.get(f"/courses/{course_b}/notes", headers=hb).json() == [])
    intact = client.get(f"/notes/{secret['id']}", headers=ha).json()
    check("Alice's note is untouched after Bob's attempts", intact["content"] == "alice-secret" and intact["title"] == "Alice private")


def test_requires_auth():
    h, course_id, _ = make_user_and_course("carol")
    note = client.post(f"/courses/{course_id}/notes", json={}, headers=h).json()
    for label, resp in [
        ("list", client.get(f"/courses/{course_id}/notes")),
        ("create", client.post(f"/courses/{course_id}/notes", json={})),
        ("get", client.get(f"/notes/{note['id']}")),
        ("patch", client.patch(f"/notes/{note['id']}", json={"content": "x"})),
        ("delete", client.delete(f"/notes/{note['id']}")),
    ]:
        check(f"{label} without a token -> 401", resp.status_code == 401)
    bad = {"Authorization": "Bearer not-a-real-token"}
    check("garbage token -> 401", client.get(f"/notes/{note['id']}", headers=bad).status_code == 401)


def test_limits():
    h, course_id, _ = make_user_and_course("dave")
    r = client.post(f"/courses/{course_id}/notes", json={"title": "t" * (main.NOTE_TITLE_MAX_CHARS + 1)}, headers=h)
    check("over-long title on create -> 422", r.status_code == 422)
    r = client.post(f"/courses/{course_id}/notes", json={"content": "c" * (main.NOTE_CONTENT_MAX_CHARS + 1)}, headers=h)
    check("over-long content on create -> 422", r.status_code == 422)

    ok = client.post(
        f"/courses/{course_id}/notes",
        json={"title": "t" * main.NOTE_TITLE_MAX_CHARS, "content": "c" * main.NOTE_CONTENT_MAX_CHARS},
        headers=h,
    )
    check("exactly-at-limit note is accepted", ok.status_code == 200)
    nid = ok.json()["id"]
    check("over-long content on patch -> 422", client.patch(f"/notes/{nid}", json={"content": "c" * (main.NOTE_CONTENT_MAX_CHARS + 1)}, headers=h).status_code == 422)
    check("failed patch left the stored note intact", len(client.get(f"/notes/{nid}", headers=h).json()["content"]) == main.NOTE_CONTENT_MAX_CHARS)

    # Per-course cap: fill straight through the DB (fast), then confirm the API refuses more
    db = main.SessionLocal()
    try:
        user_id = db.query(main.Course).filter(main.Course.id == course_id).first().user_id
        have = db.query(main.Note).filter(main.Note.course_id == course_id).count()
        db.add_all([main.Note(user_id=user_id, course_id=course_id) for _ in range(main.NOTES_PER_COURSE_MAX - have)])
        db.commit()
    finally:
        db.close()
    r = client.post(f"/courses/{course_id}/notes", json={}, headers=h)
    check("creating past the per-course cap -> 400", r.status_code == 400)
    # A different course of the same user is unaffected by the cap
    db = main.SessionLocal()
    try:
        other = main.Course(user_id=user_id, name="second course")
        db.add(other)
        db.commit()
        other_id = other.id
    finally:
        db.close()
    check("cap is per course, not per user", client.post(f"/courses/{other_id}/notes", json={}, headers=h).status_code == 200)


def test_cascades():
    h, course_id, user_id = make_user_and_course("erin")
    keep_h, keep_course, keep_uid = make_user_and_course("frank")
    for _ in range(3):
        client.post(f"/courses/{course_id}/notes", json={"content": "x"}, headers=h)
    client.post(f"/courses/{keep_course}/notes", json={"content": "keep me"}, headers=keep_h)
    check("notes exist before course delete", count_notes(course_id=course_id) == 3)

    r = client.delete(f"/courses/{course_id}", headers=h)
    check("delete course -> 200", r.status_code == 200)
    check("deleting a course deletes its notes", count_notes(course_id=course_id) == 0)
    check("other users' notes are unaffected", count_notes(user_id=keep_uid) == 1)

    # Account deletion
    course2 = client.post("/courses", json={"name": "Second"}, headers=h).json()["id"]
    client.post(f"/courses/{course2}/notes", json={"content": "y"}, headers=h)
    check("note exists before account delete", count_notes(user_id=user_id) == 1)
    r = client.delete("/auth/delete-account", headers=h)
    check("delete account -> 200", r.status_code == 200)
    check("deleting an account deletes its notes", count_notes(user_id=user_id) == 0)
    check("other users' notes survive account deletion", count_notes(user_id=keep_uid) == 1)


if __name__ == "__main__":
    try:
        test_crud_happy_path()
        test_user_isolation()
        test_requires_auth()
        test_limits()
        test_cascades()
        print("\nAll notes tests passed.")
    finally:
        try:
            os.remove(_DB_PATH)
        except OSError:
            pass
