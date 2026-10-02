#!/usr/bin/env python3
"""Seed a LOCAL backend (default http://localhost:8000) with a test account, courses and
deadlines for trying the app in the iOS Simulator. Refuses to run against anything but localhost.

  python3 scripts/seed-local.py            # then sign in with the credentials below
"""
import json
import sys
import urllib.request
from datetime import date, timedelta

API = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
assert API.startswith(("http://localhost", "http://127.0.0.1")), "seed-local only targets a local backend"

EMAIL = "sim-tester@example.edu"
PASSWORD = "simulator-pass-123"


def call(method, path, body=None, token=None):
    req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body is not None else None)
    req.add_header("Content-Type", "application/json")
    req.add_header("X-Real-IP", "127.0.0.9")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")


status, tok = call("POST", "/auth/register", {"email": EMAIL, "password": PASSWORD})
if status == 409:
    status, tok = call("POST", "/auth/login", {"email": EMAIL, "password": PASSWORD})
token = tok["access_token"]
call("POST", "/me/profile", {"full_name": "Sam Tester", "school_name": "College of Charleston"}, token)

today = date.today()
d = lambda n: (today + timedelta(days=n)).isoformat()
courses = [("Principles of Finance", "FINC 303"), ("Intro to Psychology", "PSYC 103"), ("Data Structures", "CSCI 230")]
ids = []
for name, code in courses:
    _, c = call("POST", "/courses", {"name": name, "code": code, "semester": "Fall 2026"}, token)
    ids.append(c["id"])

rows = [
    (0, "Problem Set 4", "Assignment", "23:59", 0), (-2, "Reading response 3", "Assignment", None, 1),
    (1, "Quiz: Learning & Memory", "Quiz", "10:00", 1), (3, "Linked list lab", "Assignment", "23:59", 2),
    (5, "Midterm Exam", "Exam", "09:25", 0), (9, "Research proposal draft", "Project", None, 1),
    (12, "Hash table project", "Project", "23:59", 2), (20, "Midterm Exam", "Exam", "14:00", 1),
]
for off, title, typ, time, ci in rows:
    call("POST", "/deadlines", {"title": title, "date": d(off), "type": typ, "time": time, "course_id": ids[ci]}, token)
call("POST", "/deadlines", {"title": "Buy blue books", "date": d(2), "type": "Deadline"}, token)
print(f"Seeded {API}: {len(courses)} courses, {len(rows) + 1} deadlines for {EMAIL}")
