#!/usr/bin/env python3
"""
Offline tests for syllabus parsing (no network: the OpenAI client is stubbed).

No pytest in this project -- run directly: `python3 test_syllabus_parsing.py`.

Covers the accuracy fixes found with a synthetic syllabus test set (gpt-4o-mini: 71% -> 97% of
deadlines with gpt-4.1-mini):
  - PDF tables come out once, in reading order (they used to be printed twice, ahead of headings)
  - long syllabi aren't cut at 25k chars: the schedule at the end is read (chunked past 100k)
  - JSON-object replies ({"deadlines": [...]}) and plain lists both parse
  - "Week 5, Thursday" dates are computed in code from the term start, skipping a break week
  - weekly items start on their stated first date and skip break days
  - "Lecture Quiz 2" / "Week 3 Reflection" are kept; bare "Lecture" / "Week 3" rows are dropped
  - times are normalized ("11:59pm" -> "11:59 PM"); unparseable dates are dropped
  - the model falls back to gpt-4o-mini when the configured one isn't available
"""
import asyncio
import io
import json
import os
import tempfile
from datetime import date

_DB_FD, _DB_PATH = tempfile.mkstemp(suffix=".db")
os.close(_DB_FD)
os.environ["OPENAI_API_KEY"] = "sk-test"
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_PATH}"
os.environ["JWT_SECRET"] = "test-jwt-secret-for-syllabus"

import main  # noqa: E402


class _Msg:
    def __init__(self, content):
        self.message = type("M", (), {"content": content})


class FakeCompletions:
    def __init__(self):
        self.calls = []
        self.replies = []
        self.fail_models = set()

    async def create(self, **kw):
        self.calls.append(kw)
        if kw.get("model") in self.fail_models:
            err = Exception(f"The model `{kw['model']}` does not exist")
            err.status_code = 404
            raise err
        reply = self.replies.pop(0) if self.replies else '{"deadlines": []}'
        return type("R", (), {"choices": [_Msg(reply)]})


fake = FakeCompletions()
main.client = type("C", (), {"chat": type("Ch", (), {"completions": fake})})()

META = {"start_date": "2027-01-12", "end_date": "2027-04-27", "semester": "Spring 2027",
        "breaks": [{"name": "Spring Break", "start": "2027-03-08", "end": "2027-03-12"}]}


def run(coro):
    return asyncio.run(coro)


def test_pdf_tables_once_in_order():
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib import colors
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Table, TableStyle
    except ImportError:
        print("  (reportlab not installed: skipped)")
        return
    buf = io.BytesIO()
    ss = getSampleStyleSheet()
    SimpleDocTemplate(buf, pagesize=letter).build([
        Paragraph("FINC 310 Investments", ss["Title"]), Paragraph("Course Schedule", ss["Heading2"]),
        Table([["Week", "Date", "Due"], ["1", "Jan 14", "Quiz 1"], ["2", "Jan 21", "HW 1"]],
              style=TableStyle([("GRID", (0, 0), (-1, -1), 0.5, colors.grey)])),
        Paragraph("Final exam: May 4", ss["BodyText"]),
    ])
    text = main._extract_pdf_text_raw(buf.getvalue())
    assert text.count("Quiz 1") == 1, text
    assert text.index("Course Schedule") < text.index("Quiz 1") < text.index("Final exam"), text
    assert "1 | Jan 14 | Quiz 1" in text, text


def test_long_syllabus_reads_the_end():
    fake.calls.clear()
    fake.replies = ['{"deadlines": [{"date": "2027-03-04", "type": "Exam", "title": "Midterm Exam"}]}']
    text = "policy " * 6000 + "\nMidterm Exam: March 4, 2027"  # ~42k chars
    out = run(main.extract_deadlines_with_context(text, dict(META)))
    sent = fake.calls[0]["messages"][1]["content"]
    assert "Midterm Exam: March 4, 2027" in sent, "the end of a long syllabus must reach the model"
    assert fake.calls[0]["response_format"] == {"type": "json_object"}
    assert [d["title"] for d in out] == ["Midterm Exam"], out
    # Past the single-call limit the text is read in overlapping chunks and merged
    fake.calls.clear()
    fake.replies = ['{"deadlines": [{"date": "2027-02-01", "type": "Quiz", "title": "Quiz 1"}]}',
                    '{"deadlines": [{"date": "2027-04-01", "type": "Exam", "title": "Exam 2"}]}']
    out = run(main.extract_deadlines_with_context("x" * 150_000, dict(META)))
    assert len(fake.calls) == 2 and sorted(d["title"] for d in out) == ["Exam 2", "Quiz 1"], out


def test_plain_list_reply_still_parses():
    fake.replies = ['```json\n[{"date": "2027-02-01", "type": "Quiz", "title": "Quiz 1"}]\n```']
    out = run(main.extract_deadlines_with_context("syllabus", dict(META)))
    assert [d["title"] for d in out] == ["Quiz 1"], out


def test_week_number_dates_computed_in_code():
    start, breaks = date(2027, 1, 12), [(date(2027, 3, 9), date(2027, 3, 11))]
    assert main._date_for_week(1, "Tuesday", start, breaks) == date(2027, 1, 12)
    assert main._date_for_week(3, "Thursday", start, breaks) == date(2027, 1, 28)
    assert main._date_for_week(8, "Tue", start, breaks) == date(2027, 3, 2)
    assert main._date_for_week(9, "Tuesday", start, breaks) == date(2027, 3, 16), "break week isn't counted"
    assert main._date_for_week(0, "Tuesday", start, breaks) is None
    assert main._date_for_week(3, "someday", start, breaks) is None
    # The model's own (wrong) date is replaced when the syllabus only gave a week
    fake.replies = [json.dumps({"deadlines": [
        {"date": "2027-02-14", "type": "Exam", "title": "Exam 1", "date_as_written": "Week 7, Thursday", "week": 7, "weekday": "Thursday"},
        {"date": "2027-01-30", "type": "Quiz", "title": "Quiz 1", "date_as_written": "Jan 30"},
    ]})]
    meta = dict(META, breaks=[{"start": "2027-03-09", "end": "2027-03-11"}])
    out = {d["title"]: d["date"] for d in run(main.extract_deadlines_with_context("s", meta))}
    assert out == {"Exam 1": "2027-02-25", "Quiz 1": "2027-01-30"}, out


def test_weekly_items_skip_breaks_and_start_when_stated():
    out = main.expand_recurring_deadlines(
        [{"date": "2027-01-25", "type": "Quiz", "title": "Reading Quiz", "recurring": True, "frequency": "weekly", "day_of_week": "Monday"}],
        "2027-01-12", "2027-04-27", [(date(2027, 3, 8), date(2027, 3, 12))])
    dates = [d["date"] for d in out]
    assert dates[0] == "2027-01-25", dates
    assert "2027-03-08" not in dates and "2027-03-15" in dates, dates


def test_validation_keeps_real_deliverables():
    rows = [{"date": "2027-01-29", "title": t} for t in
            ["Week 3 Reflection", "Lecture Quiz 2", "Lecture", "Week 3", "Office hours", "Class meeting", "Lab Report 1",
             "Spring Break", "MLK Holiday - no classes", "Spring Break Reflection due"]]
    kept = [d["title"] for d in main.validate_deadlines(rows)]
    assert kept == ["Week 3 Reflection", "Lecture Quiz 2", "Lab Report 1", "Spring Break Reflection due"], kept


def test_normalizes_times_and_drops_bad_dates():
    fake.replies = [json.dumps({"deadlines": [
        {"date": "2027-02-01", "type": "Homework", "title": "HW 1", "time": "11:59pm"},
        {"date": "2027-02-02", "type": "Quiz", "title": "Quiz 1", "time": "14:00"},
        {"date": "sometime in Feb", "type": "Quiz", "title": "Pop quiz"},
    ]})]
    out = {d["title"]: d.get("time") for d in run(main.extract_deadlines_with_context("s", dict(META)))}
    assert out == {"HW 1": "11:59 PM", "Quiz 1": "2:00 PM"}, out


def test_model_fallback():
    fake.calls.clear()
    fake.fail_models = {main.SYLLABUS_MODEL}
    fake.replies = ['{"deadlines": [{"date": "2027-02-01", "type": "Quiz", "title": "Quiz 1"}]}']
    try:
        out = run(main.extract_deadlines_with_context("s", dict(META)))
    finally:
        fake.fail_models = set()
    assert [c["model"] for c in fake.calls] == [main.SYLLABUS_MODEL, main.SYLLABUS_FALLBACK_MODEL], [c["model"] for c in fake.calls]
    assert [d["title"] for d in out] == ["Quiz 1"]


def test_term_guess_when_syllabus_is_silent():
    assert main._guess_term_dates(date(2026, 10, 10))[2] == "Fall 2026"
    assert main._guess_term_dates(date(2026, 12, 1))[2] == "Spring 2027"
    assert main._guess_term_dates(date(2027, 2, 1))[2] == "Spring 2027"


if __name__ == "__main__":
    import contextlib
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    failed = 0
    for t in tests:
        try:
            with contextlib.redirect_stdout(io.StringIO()):
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
