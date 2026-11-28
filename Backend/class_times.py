"""Turn a syllabus's free-text meeting times into weekly class slots.

Examples it handles: "MWF 9-9:50am", "TR 8:00-9:20am", "Mon/Wed 3:00-4:15 PM",
"Monday 10:00 AM - 10:50 AM, Wednesday 10:00 AM - 10:50 AM", "T 08:30AM - 11:20AM",
"Tuesdays and Thursdays from 2 to 3:15 pm", "Mon 8:35 AM" (no end: 50 minutes assumed).
Returns [] for "Online", "TBA", asynchronous classes, or anything it can't read with confidence:
a wrong class time is worse than none.
"""
from __future__ import annotations

import re

DAY_WORDS = {
    "monday": 0, "mon": 0, "mo": 0, "m": 0,
    "tuesday": 1, "tues": 1, "tue": 1, "tu": 1, "t": 1,
    "wednesday": 2, "wed": 2, "we": 2, "w": 2,
    "thursday": 3, "thurs": 3, "thur": 3, "thu": 3, "th": 3, "r": 3, "h": 3,
    "friday": 4, "fri": 4, "fr": 4, "f": 4,
    "saturday": 5, "sat": 5, "sa": 5, "s": 5,
    "sunday": 6, "sun": 6, "su": 6, "u": 6,
}
DEFAULT_MINUTES = 50

_TIME = r"(\d{1,2})(?::(\d{2}))?\s*([ap]\.?\s?m\.?)?"
_RANGE = re.compile(_TIME + r"\s*(?:-|–|—|to|until)\s*" + _TIME, re.I)
_SINGLE = re.compile(r"(?<![\d:])" + _TIME + r"(?![\d:])", re.I)
_COMPACT_DAYS = re.compile(r"\b(M?T?W?(?:Th|R|H)?F?(?:Sa|S)?(?:Su|U)?)\b")  # MWF, TR, MW, TTh


def _ampm(s: str | None) -> str | None:
    if not s:
        return None
    return "pm" if s.lower().replace(".", "").strip().startswith("p") else "am"


def _to_min(h: str, m: str | None, ap: str | None) -> int | None:
    hh, mm = int(h), int(m or 0)
    if hh > 23 or mm > 59:
        return None
    if ap == "pm" and hh < 12:
        hh += 12
    if ap == "am" and hh == 12:
        hh = 0
    return hh * 60 + mm


def _resolve(h1, m1, ap1, h2, m2, ap2):
    """Fill in a missing am/pm the way people write ranges ("9-9:50am", "2:00-3:15 PM", "11-12:15")."""
    a1, a2 = _ampm(ap1), _ampm(ap2)
    if not a1 and a2:
        a1 = a2
        if a2 == "pm" and int(h1) < 12 and int(h2) == 12:
            a1 = "am"  # 11-12:15pm
        elif a2 == "pm" and int(h1) > int(h2) and int(h2) != 12 and int(h1) != 12:
            a1 = "am"  # 11:30-1:00pm (but 12:20-1:10pm stays pm)
    if not a1 and not a2:  # no am/pm at all: classes run 7am-9:59pm
        a1 = "pm" if 1 <= int(h1) <= 6 else "am"
        a2 = "pm" if 1 <= int(h2) <= 6 or int(h2) == 12 else ("am" if int(h2) >= int(h1) and int(h1) >= 7 and int(h2) < 12 else "pm")
    start, end = _to_min(h1, m1, a1), _to_min(h2, m2, a2 or a1)
    if start is None or end is None:
        return None
    if end <= start:
        end += 12 * 60 if end + 12 * 60 > start and end < 12 * 60 else 0
    if not (6 * 60 <= start < 23 * 60) or not (start < end <= start + 6 * 60):
        return None
    return start, end


def _days_in(text: str) -> list[int]:
    days: list[int] = []
    for word in re.findall(r"[A-Za-z]+", text):
        w = word.lower().rstrip("s") if len(word) > 3 else word.lower()
        if w in DAY_WORDS and len(w) >= 2:
            d = DAY_WORDS[w]
            if d not in days:
                days.append(d)
            continue
        # compact codes: MWF, TR, MW, TTh, TuTh (must be uppercase-ish letters only)
        if word.isalpha() and len(word) <= 7 and (word.isupper() or re.fullmatch(r"(M|Tu?|W|Th|R|F)+", word)):
            i = 0
            parsed = []
            while i < len(word):
                two = word[i:i + 2].lower()
                if two in ("th", "tu", "sa", "su") and two in DAY_WORDS:
                    parsed.append(DAY_WORDS[two]); i += 2; continue
                one = word[i].lower()
                if one in DAY_WORDS:
                    parsed.append(DAY_WORDS[one]); i += 1; continue
                parsed = []
                break
            for d in parsed:
                if d not in days:
                    days.append(d)
    return days


def parse_meeting_times(text: str | None) -> list[dict]:
    """[{"day": 0-6 (Mon=0), "start": "HH:MM", "end": "HH:MM"}], deduplicated, sorted."""
    if not text or not isinstance(text, str):
        return []
    t = text.strip()
    if re.search(r"\b(online|asynchronous|async|tba|tbd|arranged|n/?a)\b", t, re.I) and not _RANGE.search(t):
        return []
    slots: set[tuple[int, int, int]] = set()
    # Split into chunks that each carry days + a time: "Mon 10-10:50, Wed 10-10:50" or "MWF 9-9:50am; Lab T 2-4pm"
    chunks = re.split(r"[;,\n]|\band\b(?=\s*(?:mon|tue|wed|thu|fri|sat|sun|[MTWRF]{1,4}\b))", t, flags=re.I)
    pending_days: list[int] = []
    pending_range: tuple[int, int] | None = None  # "1:05 p.m. to 1:55 p.m., MWF": time first, days later
    for chunk in chunks:
        days = _days_in(chunk)
        rng = _RANGE.search(chunk)
        if rng:
            se = _resolve(*rng.groups())
            use = pending_days + [d for d in days if d not in pending_days]
            if se and use:
                for d in use:
                    slots.add((d, se[0], se[1]))
            elif se and not use:
                pending_range = se
            pending_days = []
            continue
        if days and pending_range and not _SINGLE.search(chunk):
            for d in days:
                slots.add((d, pending_range[0], pending_range[1]))
            pending_range = None
            continue
        single = _SINGLE.search(chunk) if days or pending_days else None
        if single and (single.group(2) or single.group(3)):
            ap = _ampm(single.group(3)) or ("pm" if 1 <= int(single.group(1)) <= 6 else "am")
            st = _to_min(single.group(1), single.group(2), ap)
            if st is not None and 6 * 60 <= st < 23 * 60:
                for d in pending_days + [d for d in days if d not in pending_days]:
                    slots.add((d, st, st + DEFAULT_MINUTES))
                pending_days = []
                continue
        if days:
            pending_days = pending_days + [d for d in days if d not in pending_days]
    # Standalone start times (not part of a range): more than one distinct value means sections
    # ("M/W/F 9am, 11am, 1pm"), so don't guess.
    spans = [m.span() for m in _RANGE.finditer(t)]
    singles = set()
    for m in _SINGLE.finditer(t):
        if any(a <= m.start() < b for a, b in spans) or not (m.group(2) or m.group(3)):
            continue
        ap = _ampm(m.group(3)) or ("pm" if 1 <= int(m.group(1)) <= 6 else "am")
        singles.add(_to_min(m.group(1), m.group(2), ap))
    if len(singles) > 1:
        return []
    # Several different times on the same weekday usually means the syllabus lists every section
    # ("MWF 9am, 11am, 1pm"). We can't know the student's section, so we don't guess.
    per_day: dict[int, set] = {}
    for d, st, en in slots:
        per_day.setdefault(d, set()).add((st, en))
    if any(len(v) > 1 for v in per_day.values()):
        return []
    if re.search(r"\bsection\b", t, re.I) and len({(st, en) for _, st, en in slots}) > 1:
        return []
    return [{"day": d, "start": f"{s // 60:02d}:{s % 60:02d}", "end": f"{e // 60:02d}:{e % 60:02d}"}
            for d, s, e in sorted(slots)]
