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
  - search (?q=): case-insensitive on title + body, snippets, literal % and _, isolation
  - list previews strip markdown markers; ?full=true includes bodies (and only then)
  - the student's notes reach the chat context (private, budgeted, ranked by relevance)
  - chat quizzes/flashcards "from my notes": intent detection, note selection, grounded prompts
  - a note's text can be run through the real flashcard / quiz / summary endpoints as a .txt
    upload (OpenAI faked), including the free-tier limit and minimum-length behaviour
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


def check(name: str, condition: bool, detail: str = ""):
    status = "PASS" if condition else "FAIL"
    print(f"[{status}] {name}" + (f"  -> {detail}" if detail and not condition else ""))
    if not condition:
        raise AssertionError(f"{name} {detail}".strip())


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


def add_note(user_id, course_id, title="", content="", updated_at=None):
    db = main.SessionLocal()
    try:
        n = main.Note(user_id=user_id, course_id=course_id, title=title, content=content)
        if updated_at is not None:
            n.updated_at = updated_at
        db.add(n)
        db.commit()
        return n.id
    finally:
        db.close()


def test_search_and_full():
    h, course, uid = make_user_and_course("gina")
    hb, course_b, uid_b = make_user_and_course("hank")
    long_body = ("intro filler " * 20) + "the ELASTICITY of demand matters here " + ("outro filler " * 20)
    t_id = client.post(f"/courses/{course}/notes", json={"title": "Elasticity basics", "content": "nothing relevant"}, headers=h).json()["id"]
    b_id = client.post(f"/courses/{course}/notes", json={"title": "Week 2", "content": long_body}, headers=h).json()["id"]
    pct = client.post(f"/courses/{course}/notes", json={"title": "Sale", "content": "everything is 50% off"}, headers=h).json()["id"]
    und = client.post(f"/courses/{course}/notes", json={"title": "Vars", "content": "use snake_case names"}, headers=h).json()["id"]
    plain = client.post(f"/courses/{course}/notes", json={"title": "Other", "content": "plain words"}, headers=h).json()["id"]
    # another course of the same user, and another user's course: same search term must not leak
    other_course = client.post("/courses", json={"name": "Other course"}, headers=h).json()["id"]
    client.post(f"/courses/{other_course}/notes", json={"title": "elasticity elsewhere", "content": "x"}, headers=h)
    client.post(f"/courses/{course_b}/notes", json={"title": "elasticity bob", "content": "bob-secret"}, headers=hb)

    def search(q, headers=h, cid=None):
        r = client.get(f"/courses/{cid or course}/notes", params={"q": q}, headers=headers)
        return r

    r = search("elasticity")
    ids = {n["id"] for n in r.json()}
    check("search is case-insensitive and matches title + body", r.status_code == 200 and ids == {t_id, b_id}, str(ids))
    check("search is scoped to the course (other course's note not returned)", all("elsewhere" not in n["title"] for n in r.json()))
    check("search never returns another user's notes", all("bob" not in n["title"] and "bob-secret" not in n["preview"] for n in r.json()))
    snippet = next(n for n in r.json() if n["id"] == b_id)["preview"]
    check("body match: snippet is centered on the match", "ELASTICITY of demand" in snippet and snippet.startswith("…") and snippet.endswith("…"), snippet)
    check("snippet is short", len(snippet) <= 210, str(len(snippet)))
    title_hit = next(n for n in r.json() if n["id"] == t_id)
    check("title-only match falls back to the normal preview", title_hit["preview"] == "nothing relevant")

    check("'%' is searched literally (matches only the note containing it)", [n["id"] for n in search("%").json()] == [pct])
    check("'_' is searched literally (matches only the note containing it)", [n["id"] for n in search("_").json()] == [und])
    check("no match -> empty list", search("zzzz-nope").json() == [])
    check("whitespace-only query = no filter", len(search("   ").json()) == 5)
    check("query over 100 chars -> 422", search("q" * 101).status_code == 422)
    check("another user's course search -> 404", search("elasticity", headers=hb).status_code == 404)
    check("bob searching his own course sees only his note", [n["title"] for n in search("elasticity", headers=hb, cid=course_b).json()] == ["elasticity bob"])

    # full=true
    default = client.get(f"/courses/{course}/notes", headers=h).json()
    check("default list has no bodies", all("content" not in n for n in default))
    full = client.get(f"/courses/{course}/notes", params={"full": "true"}, headers=h).json()
    check("full=true includes complete bodies", {n["id"]: n["content"] for n in full}[b_id] == long_body)
    check("full + q combine", [n["id"] for n in client.get(f"/courses/{course}/notes", params={"full": "true", "q": "snake"}, headers=h).json()] == [und])


def test_preview_strips_markdown():
    h, course, _ = make_user_and_course("ivy")
    body = "## Heading\n- [ ] task one\n- [x] done **bold** item\n> quoted `code`\n1. first\n* star bullet"
    nid = client.post(f"/courses/{course}/notes", json={"title": "md", "content": body}, headers=h).json()["id"]
    prev = client.get(f"/courses/{course}/notes", headers=h).json()[0]["preview"]
    check("markdown markers are stripped from the preview", prev == "Heading task one done bold item quoted code first star bullet", prev)
    check("the stored body is untouched (still markdown)", client.get(f"/notes/{nid}", headers=h).json()["content"] == body)


def notes_section(ctx: str) -> str:
    marker = "## Student's Own Notes"
    if marker not in ctx:
        return ""
    rest = ctx.split(marker, 1)[1]
    return rest.split("\n## ", 1)[0]


def test_chat_context_notes():
    from datetime import datetime, timedelta

    def ctx_for(uid, message=None):
        db = main.SessionLocal()
        try:
            return main._build_chat_context(db, uid, message)
        finally:
            db.close()

    # basics: own notes included, others' excluded, empty-body notes omitted, no header without notes
    _, course, uid = make_user_and_course("jo")
    _, course_b, uid_b = make_user_and_course("kim")
    check("no notes -> no notes section", "Student's Own Notes" not in ctx_for(uid))
    add_note(uid, course, "Kessler lecture", "The Kessler equilibrium is reached when marginal cost equals price.")
    add_note(uid, course, "Title only, no body", "")
    add_note(uid_b, course_b, "Bob private", "bob-private-notes-content")
    ctx = ctx_for(uid, "hi")
    check("own note title + body are in the context", "Kessler lecture" in ctx and "marginal cost equals price" in ctx)
    check("course label is attached to the note", "Course: jo course" in notes_section(ctx))
    check("another user's notes never appear", "bob-private-notes-content" not in ctx and "Bob private" not in ctx)
    check("notes with an empty body are skipped", "Title only, no body" not in ctx)
    check("bob's context has only his own note", "bob-private-notes-content" in ctx_for(uid_b) and "Kessler" not in ctx_for(uid_b))

    # per-note truncation and total budget
    _, course2, uid2 = make_user_and_course("lee")
    for i in range(6):
        add_note(uid2, course2, f"big {i}", f"{i}" * 5000, updated_at=datetime.utcnow() - timedelta(minutes=i))
    sec = notes_section(ctx_for(uid2, "hi"))
    check("total notes budget caps how many notes are included (4 of 6 at 2500 chars)", sec.count("[Note:") == 4, str(sec.count("[Note:")))
    check("truncated notes are marked", "…[truncated]" in sec)
    check("section stays near the budget", len(sec) <= main.MAX_NOTES_CONTEXT_TOTAL + 4 * 200, str(len(sec)))

    # relevance: an OLD note the student asks about beats newer, unrelated notes even when the budget is full
    _, course3, uid3 = make_user_and_course("max")
    add_note(uid3, course3, "Zorblatt Convention", "Signed in 1847; established the Zorblatt tariff schedule.", updated_at=datetime.utcnow() - timedelta(days=90))
    for i in range(12):
        add_note(uid3, course3, f"filler {i}", "unrelated filler text " * 120, updated_at=datetime.utcnow() - timedelta(minutes=i))
    check("without a relevant message the old note is crowded out by recent ones", "Zorblatt tariff" not in ctx_for(uid3, "how am I doing?"))
    check("asking about it pulls the old note in (keyword relevance)", "Zorblatt tariff schedule" in ctx_for(uid3, "What do my notes say about the Zorblatt convention?"))

    # relevance: mentioning a course code boosts that course's notes
    db = main.SessionLocal()
    try:
        psyc = main.Course(user_id=uid3, name="Intro Psychology", code="PSYC 240")
        db.add(psyc)
        db.commit()
        psyc_id = psyc.id
    finally:
        db.close()
    add_note(uid3, psyc_id, "Memory", "Working memory holds about seven items.", updated_at=datetime.utcnow() - timedelta(days=200))
    check("old note is excluded when nothing points at its course", "Working memory holds" not in ctx_for(uid3, "what should I do today"))
    check("mentioning the course code includes that course's notes", "Working memory holds" in ctx_for(uid3, "quiz me on my PSYC 240 notes"))


def test_note_to_study_tools():
    """The frontend sends a note's text as a .txt upload to the three existing generators."""
    import json as _json
    from types import SimpleNamespace

    calls = []

    class FakeCompletions:
        async def create(self, **kw):
            sys_prompt = kw["messages"][0]["content"].lower()
            calls.append(kw["messages"][-1]["content"])
            if "flashcards" in sys_prompt:
                body = _json.dumps([{"front": f"Q{i}", "back": f"A{i}"} for i in range(5)])
            elif "quiz" in sys_prompt:
                body = _json.dumps({"questions": [{"question": f"Q{i}?", "options": ["A) a", "B) b", "C) c", "D) d"], "correct_answer": "B", "explanation": "because"} for i in range(3)]})
            else:
                body = "Overview: elasticity.\n- key point"
            return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=body))])

    real_client = main.client
    main.client = SimpleNamespace(chat=SimpleNamespace(completions=FakeCompletions()))
    try:
        h, course, uid = make_user_and_course("nina")
        db = main.SessionLocal()
        try:
            db.add(main.UserProfile(user_id=uid, email=f"nina-{main.generate_uuid()}@example.com"))
            db.commit()
        finally:
            db.close()

        note_text = "## Elasticity\n- Price elasticity of demand measures how quantity responds to price.\n- [ ] Review the midpoint formula"
        fname = "Ch. 3- Elasticity.txt"  # what the frontend builds from the title "Ch. 3: Elasticity"
        upload = lambda path, text=note_text, name=fname: client.post(path, files={"file": (name, text.encode("utf-8"), "text/plain")}, headers=h)

        r1 = upload(f"/courses/{course}/flashcards")
        r2 = upload(f"/courses/{course}/generate-quiz")
        r3 = upload(f"/courses/{course}/summaries")
        check("flashcards from a note (.txt) -> 200", r1.status_code == 200, r1.text[:200])
        check("quiz from a note (.txt) -> 200", r2.status_code == 200, r2.text[:200])
        check("summary from a note (.txt) -> 200", r3.status_code == 200, r3.text[:200])
        check("the note's text is what reaches the model", len(calls) == 3 and all("Price elasticity of demand" in c and "midpoint formula" in c for c in calls))
        check("generated sets are named after the note title", r1.json()["flashcard_set"]["name"] == "Ch. 3- Elasticity" and r3.json()["title"] == "Ch. 3- Elasticity")
        detail = client.get(f"/courses/{course}", headers=h).json()
        check("all three land in the course's study library", len(detail["flashcard_sets"]) == 1 and len(detail["quizzes"]) == 1 and len(detail["summaries"]) == 1)
        check("quiz is named after the note too", detail["quizzes"][0]["name"] == "Ch. 3- Elasticity")
        db = main.SessionLocal()
        try:
            used = db.query(main.UserProfile).filter(main.UserProfile.user_id == uid).first().ai_generations_used
        finally:
            db.close()
        check("each generation counts toward the free-tier allowance (3 used)", used == 3, str(used))

        # too-short notes are refused with a clear message
        short = upload(f"/courses/{course}/flashcards", text="too short", name="tiny.txt")
        check("a very short note -> 400 'not enough text'", short.status_code == 400 and "enough text" in short.text)

        # free-tier limit -> structured 403 the frontend can recognise
        db = main.SessionLocal()
        try:
            prof = db.query(main.UserProfile).filter(main.UserProfile.user_id == uid).first()
            prof.ai_generations_used = main.FREE_AI_GENERATION_LIMIT
            db.commit()
        finally:
            db.close()
        for path in ("flashcards", "generate-quiz", "summaries"):
            r = upload(f"/courses/{course}/{path}")
            d = r.json().get("detail", {})
            check(f"at the free limit {path} -> 403 limit_reached", r.status_code == 403 and isinstance(d, dict) and d.get("error") == "limit_reached", r.text[:160])
    finally:
        main.client = real_client


def test_chat_notes_generation_helpers():
    from datetime import datetime, timedelta

    # which messages mean "use my notes"
    yes = ["quiz me on my notes", "Make flashcards from my Econ notes", "create a quiz on my notes for PSYC 240", "quiz me on the notes", "flashcards from these notes", "make a quiz on my note"]
    no = ["make me flashcards on labor markets", "make note cards on labor markets", "quiz me on supply and demand", "make notecards for chapter 3", "what is the note taking method?", "create a quiz on my notecards"]
    for m in yes:
        check(f"'{m}' is a notes request", main._mentions_notes(m))
    for m in no:
        check(f"'{m}' is NOT a notes request", not main._mentions_notes(m))

    # picks the notes: single-course, relevance-ranked, private, budgeted
    _, course_a, uid = make_user_and_course("olga")
    db = main.SessionLocal()
    try:
        b = main.Course(user_id=uid, name="Intro Psychology", code="PSYC 240")
        db.add(b)
        db.commit()
        course_b = b.id
    finally:
        db.close()
    _, other_course, other_uid = make_user_and_course("pete")
    add_note(uid, course_a, "Elasticity", "Price elasticity of demand measures responsiveness.", updated_at=datetime.utcnow() - timedelta(days=3))
    add_note(uid, course_b, "Memory", "Working memory holds about seven items.", updated_at=datetime.utcnow() - timedelta(days=1))
    add_note(other_uid, other_course, "Pete private", "pete-only-content")

    def pick(msg):
        db = main.SessionLocal()
        try:
            return main._notes_for_generation(db, uid, msg)
        finally:
            db.close()

    text, course = pick("quiz me on my notes")
    check("no course named: takes the most recent note's course", course is not None and course.id == course_b and "Working memory" in text)
    check("...and keeps to a single course", "Price elasticity" not in text)
    text, course = pick("quiz me on my elasticity notes")
    check("keyword relevance picks the matching note's course", course.id == course_a and "Price elasticity" in text)
    text, course = pick("quiz me on my PSYC 240 notes")
    check("a named course restricts the notes to that course", course.id == course_b and "Working memory" in text and "Price elasticity" not in text)
    text, course = pick("quiz me on my ECON notes")  # 'olga course' is the name; not mentioned -> falls back to ranking
    check("never includes another user's notes", "pete-only-content" not in (text or ""))
    db = main.SessionLocal()
    try:
        none_text, none_course = main._notes_for_generation(db, other_uid + "-nobody", "quiz me on my notes")
    finally:
        db.close()
    check("no notes -> (None, None), so no generic 'my notes' set gets invented", none_text is None and none_course is None)

    # budget: a huge pile of notes is cut to the generation budget
    _, course_c, uid_c = make_user_and_course("quinn")
    for i in range(10):
        add_note(uid_c, course_c, f"Big {i}", "x" * 5000, updated_at=datetime.utcnow() - timedelta(minutes=i))
    db = main.SessionLocal()
    try:
        big, _c = main._notes_for_generation(db, uid_c, "quiz me on my notes")
    finally:
        db.close()
    check("generation text respects the character budget", len(big) <= main.MAX_NOTES_GENERATION_CHARS + 200, str(len(big)))

    # prompts: grounded ONLY in the notes, right JSON shape, request echoed
    fake_course = type("C", (), {"name": "Econ", "code": "ECON 101"})()
    fc = main._notes_generation_prompt("flashcards", 15, fake_course, "make flashcards from my notes", "NOTES-BODY")
    qz = main._notes_generation_prompt("quiz", 10, fake_course, "quiz me on my notes", "NOTES-BODY")
    check("flashcard prompt is grounded in the notes only", "NOTES-BODY" in fc and "ONLY on what the student's notes" in fc and '"front"' in fc)
    check("quiz prompt is grounded in the notes only", "NOTES-BODY" in qz and "ONLY on what the student's notes" in qz and '"correct_answer"' in qz)
    check("prompts carry the course label and the student's request", "ECON 101" in fc and "quiz me on my notes" in qz)


if __name__ == "__main__":
    try:
        test_crud_happy_path()
        test_user_isolation()
        test_requires_auth()
        test_limits()
        test_cascades()
        test_search_and_full()
        test_preview_strips_markdown()
        test_chat_context_notes()
        test_note_to_study_tools()
        test_chat_notes_generation_helpers()
        print("\nAll notes tests passed.")
    finally:
        try:
            os.remove(_DB_PATH)
        except OSError:
            pass
