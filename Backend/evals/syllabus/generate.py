"""Synthetic Spring 2027 syllabi, each built around one known parser weakness, with ground truth."""
import json, os, random
from datetime import date, timedelta
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Frame, PageTemplate, BaseDocTemplate, FrameBreak

OUT = os.path.dirname(__file__)
ss = getSampleStyleSheet()
P = lambda t, s="BodyText": Paragraph(t, ss[s])
random.seed(7)

POLICY = ("Students are expected to attend every class session and arrive on time. Absences may be excused with documentation from the Dean of Students. "
          "Late work will be accepted up to 48 hours after the deadline with a 10% penalty per day. Academic integrity is taken seriously; any violation of the "
          "Honor Code will be reported. Students with accommodations should contact the Center for Disability Services within the first two weeks. "
          "Electronic devices should be used only for course activities. Course materials are posted on OAKS and students are responsible for checking announcements. ")

def header(code, name, prof="Dr. Jane Smith", email="smithj@cofc.edu", hours="Tue/Thu 1:00-2:30 PM, Beatty 305"):
    return [P(f"{code}: {name}", "Title"), P("Spring 2027 &mdash; College of Charleston"),
            P(f"Instructor: {prof} &middot; Email: {email} &middot; Office hours: {hours}"),
            P("Class meets Tuesday/Thursday 10:50 AM&ndash;12:05 PM in Beatty 115. First day of class: January 12, 2027. Last day of class: April 27, 2027."),
            P("Grading: Exams 45% (Midterm 20%, Final 25%), Quizzes 15%, Homework 20%, Project 20%."), Spacer(1, 8)]

def table(rows, widths=None):
    t = Table(rows, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.5, colors.grey), ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey), ("FONTSIZE", (0, 0), (-1, -1), 8)]))
    return t

def build(name, story):
    SimpleDocTemplate(os.path.join(OUT, name + ".pdf"), pagesize=letter).build(story)

truth = {}
d = lambda m, dd: date(2027, m, dd)
fmt = lambda x: x.isoformat()

# 1. Schedule table with Week | Date | Topic | Due (year-less "Jan 14" style dates)
rows = [["Week", "Date", "Topic", "Due / Assessment"]]
items = []
cur = d(1, 12)
plan = {d(1, 21): ("Quiz", "Quiz 1"), d(2, 4): ("Homework", "HW 1 due"), d(2, 18): ("Quiz", "Quiz 2"), d(3, 2): ("Exam", "Midterm Exam"),
        d(3, 25): ("Homework", "HW 2 due"), d(4, 8): ("Quiz", "Quiz 3"), d(4, 15): ("Project", "Group Project due"), d(4, 22): ("Presentation", "Project Presentations")}
wk = 1
while cur <= d(4, 27):
    for off in (0, 2):
        day = cur + timedelta(days=off)
        if day > d(4, 27): break
        if d(3, 8) <= day <= d(3, 12):
            rows.append([str(wk), day.strftime("%b %d"), "Spring Break - no class", ""]); continue
        due = plan.get(day)
        rows.append([str(wk), day.strftime("%b %d"), f"Chapter {wk}: topic {off}", due[1] if due else ""])
        if due: items.append({"date": fmt(day), "type": due[0], "title": due[1]})
    cur += timedelta(days=7); wk += 1
rows.append(["Finals", "May 4", "Final Exam 8:00-11:00 AM", "Final Exam"])
items.append({"date": "2027-05-04", "type": "Exam", "title": "Final Exam"})
build("01_table", header("FINC 310", "Investments") + [P("Course Schedule", "Heading2"), table(rows, [40, 60, 230, 140])])
truth["01_table"] = items

# 2. Long policy text first, schedule at the very end (tests truncation)
story = header("HIST 201", "American History to 1877")
for i in range(70):
    story.append(P(f"<b>Policy {i + 1}.</b> " + POLICY))
items = [{"date": "2027-01-28", "type": "Quiz", "title": "Map Quiz"}, {"date": "2027-02-16", "type": "Assignment", "title": "Primary Source Paper"},
         {"date": "2027-03-04", "type": "Exam", "title": "Midterm Exam"}, {"date": "2027-04-01", "type": "Assignment", "title": "Book Review"},
         {"date": "2027-04-20", "type": "Project", "title": "Research Paper"}, {"date": "2027-05-06", "type": "Exam", "title": "Final Exam"}]
story += [P("Important Dates", "Heading2")] + [P(f"{x['title']}: {date.fromisoformat(x['date']).strftime('%A, %B %d, %Y')}") for x in items]
build("02_long", story)
truth["02_long"] = items

# 3. Relative "Week N" schedule (no calendar dates in the schedule)
items = []
rows = [["Week", "Tuesday", "Thursday"]]
plan = {(3, "Thu"): ("Quiz", "Quiz 1"), (5, "Tue"): ("Homework", "Problem Set 1 due"), (7, "Thu"): ("Exam", "Exam 1"),
        (10, "Tue"): ("Homework", "Problem Set 2 due"), (12, "Thu"): ("Exam", "Exam 2"), (14, "Tue"): ("Quiz", "Quiz 2")}
for w in range(1, 16):
    tue = d(1, 12) + timedelta(weeks=w - 1)
    if w >= 9: tue += timedelta(weeks=1)  # spring break week after week 8
    cells = []
    for name, dt in (("Tue", tue), ("Thu", tue + timedelta(days=2))):
        p = plan.get((w, name))
        cells.append(p[1] if p else "Lecture")
        if p: items.append({"date": fmt(dt), "type": p[0], "title": p[1]})
    rows.append([f"Week {w}"] + cells)
build("03_relative", header("ECON 200", "Principles of Microeconomics") +
      [P("Week 1 begins Tuesday, January 12, 2027. Spring Break is March 9-11 (no class); Week 9 begins March 16."), P("Schedule", "Heading2"), table(rows, [60, 160, 160])])
truth["03_relative"] = items

# 4. Recurring quiz every Monday, with MLK day and spring break
items = []
day = d(1, 18)
while day <= d(4, 26):
    if day not in (d(1, 18),) and not (d(3, 8) <= day <= d(3, 12)):
        items.append({"date": fmt(day), "type": "Quiz", "title": "Reading Quiz"})
    day += timedelta(days=7)
items += [{"date": "2027-02-24", "type": "Exam", "title": "Midterm"}, {"date": "2027-05-05", "type": "Exam", "title": "Final Exam"}]
build("04_recurring", header("PSYC 103", "Introduction to Psychology").__add__([
    P("Class meets Monday/Wednesday/Friday 9:00-9:50 AM."),
    P("A short online reading quiz is due every Monday by 9:00 AM, starting the second week of class (January 18 is MLK Day; no class and no quiz that day, so the first quiz is due January 25). No quiz during Spring Break (March 8-12)."),
    P("Midterm exam: Wednesday, February 24. Final exam: Wednesday, May 5, 2027 at 8:00 AM.")]))
truth["04_recurring"] = items

# 5. Titles the old filter deleted ("Week N ...", "Lecture ...")
items = [{"date": "2027-01-29", "type": "Assignment", "title": "Week 3 Reflection"}, {"date": "2027-02-10", "type": "Quiz", "title": "Lecture Quiz 2"},
         {"date": "2027-02-26", "type": "Assignment", "title": "Week 5 Lab Report"}, {"date": "2027-03-19", "type": "Exam", "title": "Exam 1"},
         {"date": "2027-04-14", "type": "Quiz", "title": "Lecture Quiz 5"}, {"date": "2027-04-30", "type": "Exam", "title": "Final Exam"}]
rows = [["Due date", "Deliverable"]] + [[date.fromisoformat(x["date"]).strftime("%m/%d/%Y"), x["title"]] for x in items]
build("05_titles", header("BIOL 111", "Concepts of Biology") + [P("Deliverables", "Heading2"), table(rows, [100, 300])])
truth["05_titles"] = items

# 6. Dense table, many items (tests output size): 3 classes a week, item most days
items = []
rows = [["#", "Date", "Topic", "Due"]]
day, n = d(1, 13), 0
while day <= d(4, 28):
    for off in (0, 2, 4):
        x = day + timedelta(days=off)
        if x > d(4, 28) or d(3, 8) <= x <= d(3, 12): continue
        n += 1
        due = ""
        if n % 2 == 0:
            due = f"Problem Set {n // 2}"; items.append({"date": fmt(x), "type": "Homework", "title": due})
        if n in (20, 40):
            due = f"Exam {n // 20}"; items.append({"date": fmt(x), "type": "Exam", "title": due})
        rows.append([str(n), x.strftime("%m/%d/%y"), f"Section {n}.1 &ndash; worked examples", due])
    day += timedelta(days=7)
build("06_dense", header("MATH 220", "Calculus II") + [P("Daily Schedule", "Heading2"), table(rows, [25, 60, 250, 120])])
truth["06_dense"] = items

json.dump(truth, open(os.path.join(OUT, "truth.json"), "w"), indent=1)
print({k: len(v) for k, v in truth.items()})
