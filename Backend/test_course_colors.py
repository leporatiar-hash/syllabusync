#!/usr/bin/env python3
"""
Two of a student's courses never share a color.
  - the server hash matches the apps' hash, so courses without a clash keep the color they had
  - courses created through the API, by LMS sync (direct inserts) or with clashing stored colors all
    end up with distinct stored colors on the next read
  - picking another course's color swaps the two
  - deadlines carry their course's color

No pytest in this project -- run directly: `python3 test_course_colors.py`. Throwaway SQLite DB.
"""
import os
import tempfile
import uuid
from datetime import datetime, timedelta

_DB_FD, _DB_PATH = tempfile.mkstemp(suffix=".db")
os.close(_DB_FD)
os.environ["OPENAI_API_KEY"] = "sk-test"
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_PATH}"
os.environ["JWT_SECRET"] = "test-jwt-secret-for-course-colors"

from starlette.testclient import TestClient  # noqa: E402

import main  # noqa: E402

client = TestClient(main.app)


def _user():
    email = f"colors-{uuid.uuid4().hex[:8]}@example.edu"
    ip = f"198.24.{uuid.uuid4().int % 250}.{uuid.uuid4().int % 250 + 1}"
    r = client.post("/auth/register", json={"email": email, "password": "password123"}, headers={"X-Real-IP": ip})
    assert r.status_code == 200, r.text
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    return client.get("/me", headers=h).json()["user_id"], h


def _insert(uid, n, color=None, cid=None):
    db = main.SessionLocal()
    try:
        base = datetime(2026, 8, 1)
        for i in range(n):
            db.add(main.Course(id=cid or str(uuid.uuid4()), user_id=uid, name=f"Course {i}", color=color, created_at=base + timedelta(minutes=i)))
        db.commit()
    finally:
        db.close()


def test_hash_matches_apps():
    # Reference values computed with the JS hash in Mobile/src/constants/theme.ts.
    assert main._palette_index_for("a1b2c3d4-0000-4e5f-9a8b-123456789abc") == 3
    assert main._palette_index_for("7f3e9d2a-11aa-4b0c-8d7e-fedcba987654") == 6
    assert main._palette_index_for("x") == 0
    print("PASS test_hash_matches_apps")


def test_unique_after_read():
    uid, h = _user()
    _insert(uid, 4, color="#5B8DEF")  # four LMS-synced courses all stored with the same blue
    _insert(uid, 8)  # plus eight with no stored color
    for i in range(3):
        assert client.post("/courses", json={"name": f"API {i}"}, headers=h).status_code == 200
    courses = client.get("/courses", headers=h).json()
    colors = [c["color"] for c in courses]
    assert len(courses) == 15 and all(colors), colors
    assert len(set(colors)) == len(colors), colors
    assert "#5B8DEF" in colors  # the oldest blue course keeps blue
    print("PASS test_unique_after_read")


def test_unclashed_course_keeps_its_color():
    uid, h = _user()
    cid = "7f3e9d2a-11aa-4b0c-8d7e-fedcba987654"
    _insert(uid, 1, cid=cid)
    c = client.get(f"/courses/{cid}", headers=h).json()
    assert c["color"] == main.COURSE_COLOR_PALETTE[6], c["color"]
    print("PASS test_unclashed_course_keeps_its_color")


def test_picking_a_taken_color_swaps():
    uid, h = _user()
    a = client.post("/courses", json={"name": "A"}, headers=h).json()["id"]
    b = client.post("/courses", json={"name": "B"}, headers=h).json()["id"]
    by_id = {c["id"]: c["color"] for c in client.get("/courses", headers=h).json()}
    old_a, old_b = by_id[a], by_id[b]
    assert old_a != old_b
    r = client.patch(f"/courses/{a}", json={"color": old_b.lower()}, headers=h)
    assert r.status_code == 200, r.text
    by_id = {c["id"]: c["color"] for c in client.get("/courses", headers=h).json()}
    assert by_id[a] == old_b and by_id[b] == old_a, (by_id, old_a, old_b)
    print("PASS test_picking_a_taken_color_swaps")


def test_deadlines_carry_course_color():
    uid, h = _user()
    cid = client.post("/courses", json={"name": "Chem"}, headers=h).json()["id"]
    r = client.post("/deadlines", json={"course_id": cid, "title": "Lab 1", "date": "2026-12-01", "type": "assignment"}, headers=h)
    assert r.status_code == 200, r.text
    color = {c["id"]: c["color"] for c in client.get("/courses", headers=h).json()}[cid]
    rows = client.get("/deadlines", headers=h).json()
    assert rows and rows[0]["course_color"] == color, rows
    print("PASS test_deadlines_carry_course_color")


if __name__ == "__main__":
    tests = [test_hash_matches_apps, test_unique_after_read, test_unclashed_course_keeps_its_color, test_picking_a_taken_color_swaps, test_deadlines_carry_course_color]
    passed = 0
    for t in tests:
        try:
            t()
            passed += 1
        except AssertionError as e:
            print(f"FAIL {t.__name__}: {e}")
    print(f"\n{passed}/{len(tests)} passed")
    os.unlink(_DB_PATH)
