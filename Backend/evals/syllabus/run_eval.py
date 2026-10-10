"""Run the real syllabus pipeline (main.py) on the synthetic syllabi and score it against truth.json."""
import asyncio, json, os, re, sys, tempfile
SY = os.path.dirname(os.path.abspath(__file__))
os.environ["DATABASE_URL"] = "sqlite:///" + tempfile.mkstemp(suffix=".db")[1]  # never the real DB
os.environ.setdefault("JWT_SECRET", "eval")
BACKEND = os.path.abspath(os.path.join(SY, "..", ".."))
sys.path.insert(0, BACKEND)
os.chdir(BACKEND)
import io, contextlib
with contextlib.redirect_stdout(io.StringIO()):
    import main

truth = json.load(open(os.path.join(SY, "truth.json")))
STOP = {"due", "the", "a", "of", "exam", "quiz", "hw", "and"}

def words(t):
    return {w for w in re.findall(r"[a-z0-9]+", (t or "").lower()) if w not in STOP}

def match(t, e):
    if t["date"] != (e.get("date") or "")[:10]:
        return False
    tw, ew = words(t["title"]), words(e.get("title"))
    return not tw or bool(tw & ew) or t["type"].lower() in (e.get("type") or "").lower()

async def run_one(name):
    pdf = open(os.path.join(SY, name + ".pdf"), "rb").read()
    with contextlib.redirect_stdout(io.StringIO()):
        text = await main.extract_pdf_text_for_syllabus(pdf)
        meta = await main.extract_course_metadata(text)
        got = await main.extract_deadlines_with_context(text, meta)
    tr = truth[name]
    hit = [t for t in tr if any(match(t, e) for e in got)]
    good = [e for e in got if any(match(t, e) for t in tr)]
    exams = [t for t in tr if t["type"] == "Exam"]
    exam_hit = [t for t in exams if t in hit]
    missed = [f"{t['date']} {t['title']}" for t in tr if t not in hit]
    extra = [f"{e.get('date')} {e.get('title')}" for e in got if e not in good]
    info = (meta.get("course_info") or {}).get("instructor") or {}
    return {"name": name, "chars": len(text), "truth": len(tr), "found": len(got), "recall": len(hit) / len(tr),
            "precision": len(good) / len(got) if got else 0.0, "exams": f"{len(exam_hit)}/{len(exams)}",
            "email_ok": info.get("email") == "smithj@cofc.edu", "semester": meta.get("semester"),
            "missed": missed[:6], "extra": extra[:6]}

async def main_():
    names = sys.argv[1:] or sorted(truth)
    rows = await asyncio.gather(*[run_one(n) for n in names])
    tot_t = sum(r["truth"] for r in rows); tot_hit = sum(round(r["recall"] * r["truth"]) for r in rows)
    for r in rows:
        print(f"{r['name']:12s} chars={r['chars']:6d} truth={r['truth']:2d} found={r['found']:2d} recall={r['recall']:.0%} precision={r['precision']:.0%} exams={r['exams']} email={r['email_ok']} sem={r['semester']}")
        if r["missed"]: print("   missed:", r["missed"])
        if r["extra"]: print("   extra: ", r["extra"])
    print(f"OVERALL recall {tot_hit}/{tot_t} = {tot_hit / tot_t:.0%}")
    json.dump(rows, open(os.path.join(SY, "last_eval.json"), "w"), indent=1)

asyncio.run(main_())
