"""
US school directory + LMS detection for "Where do you go?".

The directory (data/us_schools.json) is trimmed from the MIT-licensed university-domains-list
(https://github.com/Hipo/university-domains-list): school name + its email/web domains.

LMS detection, for a school's domain + name:
  - Brightspace (D2L): every Brightspace site answers GET /d2l/api/versions/ publicly with a JSON
    list of product versions, so a guessed host (d2l.<domain>, <root>.brightspace.com, ...) is
    confirmed in one request.
  - Canvas: Instructure's public school search (the one the Canvas Student app uses) maps a
    school name to its Canvas host; <root>.instructure.com is also tried.
Nothing here needs credentials, and no student data is sent anywhere.
"""
import asyncio
import ipaddress
import json
import os
import re
import socket
from urllib.parse import urlparse

import httpx

_DATA = os.path.join(os.path.dirname(__file__), "data", "us_schools.json")

# Hosts whose students know the LMS by another name.
LMS_BRANDS = {
    "lms.cofc.edu": "OAKS",
}

CANVAS_SEARCH = "https://sso.canvaslms.com/api/v1/accounts/search"
PROBE_TIMEOUT = 6.0

_schools: list[dict] | None = None
_by_domain: dict[str, dict] = {}


def _load() -> list[dict]:
    global _schools
    if _schools is None:
        with open(_DATA) as f:
            rows = json.load(f)
        for r in rows:
            r["_norm"] = _norm(r["n"])
            r["_root"] = r["d"].split(".")[-2] if r["d"].count(".") >= 1 else r["d"]
            for d in [r["d"], *r.get("a", [])]:
                _by_domain.setdefault(d, r)
        _schools = rows
    return _schools


def _norm(s: str) -> str:
    s = s.lower().replace("&", " and ")
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    return " ".join(s.split())


def public(r: dict) -> dict:
    return {"name": r["n"], "domain": r["d"]}


def search(q: str, limit: int = 20) -> list[dict]:
    """Rank: exact name > name starts with q > a word starts with q > domain root match > contains."""
    rows = _load()
    nq = _norm(q)
    if not nq:
        return []
    words = nq.split()
    scored = []
    for r in rows:
        name, root = r["_norm"], r["_root"]
        if name == nq:
            score = 100
        elif name.startswith(nq):
            score = 80
        elif root == nq.replace(" ", ""):
            score = 75  # "cofc", "mtsu", "uga"
        elif all(any(w.startswith(x) for w in name.split()) for x in words):
            score = 60
        elif root.startswith(nq.replace(" ", "")):
            score = 50
        elif nq in name:
            score = 40
        else:
            continue
        scored.append((score, -len(name), r))
    scored.sort(key=lambda t: (-t[0], -t[1]))
    return [public(r) for _, _, r in scored[:limit]]


def school_for_email(email: str | None) -> dict | None:
    """The school an email belongs to, matching subdomains (g.cofc.edu -> cofc.edu)."""
    _load()
    domain = (email or "").lower().rsplit("@", 1)[-1].strip()
    if "@" not in (email or "") or not domain:
        return None
    parts = domain.split(".")
    for i in range(len(parts) - 1):
        hit = _by_domain.get(".".join(parts[i:]))
        if hit:
            return public(hit)
    return None


def brand(host: str | None, provider: str | None) -> str:
    if host and host in LMS_BRANDS:
        return LMS_BRANDS[host]
    return {"brightspace": "Brightspace", "canvas": "Canvas", "blackboard": "Blackboard"}.get(provider or "", "your LMS")


def lms_option(provider: str, host: str, source: str) -> dict:
    return {"provider": provider, "host": host, "name": brand(host, provider), "source": source}


# State systems that run one Brightspace for every campus (checked live 2026-11-20).
_SDBOR = {"bhsu.edu", "sdsu.edu", "usd.edu", "dsu.edu", "northern.edu", "sdsmt.edu"}


def _system_brightspace(domain: str) -> list[str]:
    if domain in _SDBOR:
        return ["d2l.sdbor.edu"]  # South Dakota Board of Regents
    if domain == "cuny.edu" or domain.endswith(".cuny.edu"):
        return ["cuny.brightspace.com"]  # City University of New York
    return []


def _brightspace_candidates(domain: str) -> list[str]:
    root = domain.split(".")[-2] if domain.count(".") >= 1 else domain
    return [*_system_brightspace(domain), f"{root}.learn.minnstate.edu",
        f"d2l.{domain}", f"lms.{domain}", f"elearn.{domain}", f"elearning.{domain}",
        f"brightspace.{domain}", f"learn.{domain}", f"mycourses.{domain}", f"online.{domain}",
        f"courses.{domain}", f"{root}.brightspace.com", f"{root}.desire2learn.com", f"{root}.view.usg.edu",
    ]


async def _is_brightspace(client: httpx.AsyncClient, host: str) -> bool:
    try:
        r = await client.get(f"https://{host}/d2l/api/versions/", timeout=PROBE_TIMEOUT)
        if r.status_code != 200:
            return False
        data = r.json()
        return isinstance(data, list) and any(isinstance(x, dict) and "ProductCode" in x for x in data)
    except Exception:
        return False


def _blackboard_candidates(domain: str) -> list[str]:
    """Most specific first. Hosted Blackboard is usually <name>.blackboard.com (ualearn.blackboard.com)."""
    root = domain.split(".")[-2] if domain.count(".") >= 1 else domain
    return [
        f"blackboard.{domain}", f"bb.{domain}", f"bblearn.{domain}", f"learn.{domain}", f"elearning.{domain}",
        f"courses.{domain}", f"mycourses.{domain}", f"online.{domain}",
        f"{root}.blackboard.com", f"{root}learn.blackboard.com", f"{root}-blackboard.blackboard.com",
    ]


async def _is_blackboard(client: httpx.AsyncClient, host: str) -> bool:
    """Blackboard Learn answers GET /learn/api/public/v1/system/version publicly with its version."""
    try:
        r = await client.get(f"https://{host}/learn/api/public/v1/system/version", timeout=PROBE_TIMEOUT)
        if r.status_code != 200:
            return False
        data = r.json()
        return isinstance(data, dict) and isinstance(data.get("learn"), dict)
    except Exception:
        return False


async def _is_canvas(client: httpx.AsyncClient, host: str, follow: bool = False) -> str | None:
    """The Canvas host at `host`, or None. Canvas answers an unauthenticated API call with a 401 JSON
    body. With follow=True (detection's own guesses only, never typed-in input) redirects are
    followed and the host students end up on is returned, e.g. canvas.ucla.edu -> bruinlearn.ucla.edu."""
    try:
        r = await client.get(f"https://{host}/api/v1/users/self", timeout=PROBE_TIMEOUT, follow_redirects=follow)
        if r.status_code == 401 and "unauthenticated" in r.text.lower() and r.url.scheme == "https":
            return (r.url.host or host).lower()
        return None
    except Exception:
        return None


# Words that mark a directory entry as a sub-unit of the school rather than the main student
# Canvas: "UCLA Extension", "University of Michigan - Center of Academic Innovation", a lab school...
_SUBUNIT_WORDS = {
    "extension", "online", "continuing", "professional", "development", "catalog", "center", "centre",
    "high", "academy", "parents", "observers", "observer", "sandbox", "test", "training", "innovation",
    "engineering", "medicine", "medical", "law", "nursing", "dental", "pharmacy", "health", "graduate",
    "global", "community", "k12", "staff", "faculty", "alumni", "dearborn", "flint", "commons",
}


_FILLER = {"the", "of", "at", "and", "in", "campus", "main"}
# Short forms schools use in Canvas's directory ("UC Berkeley" for University of California, Berkeley).
_EXPAND = {"uc": ["university", "california"], "u": ["university"], "univ": ["university"], "st": ["state"]}


def _tokens(name: str) -> set[str]:
    """Meaningful words of a school name: no filler, no "(UVA)"-style abbreviations, short forms expanded."""
    name = re.sub(r"\([^)]*\)", " ", name)
    out: set[str] = set()
    for w in _norm(name).split():
        if w in _FILLER:
            continue
        out.update(_EXPAND.get(w, [w]))
    return out


def _want_tokens(name: str) -> list[set[str]]:
    """Ways the directory may name the school: the full name, and the part before " - "
    ("University of Michigan - Ann Arbor")."""
    variants = [name, name.split(" - ")[0]]
    return [t for t in dict.fromkeys(frozenset(_tokens(v)) for v in variants) if t]


def _score_canvas_row(row: dict, want: list[set[str]], root: str, domain: str) -> int:
    """How sure we are a Canvas directory entry is the school's main student Canvas (0 = not it)."""
    toks = _tokens(row.get("name", ""))
    host = (row.get("domain") or "").lower()
    if not toks or not host:
        return 0
    full = set().union(*want) | {root}
    if any(toks == w for w in want):
        score = 100
    elif toks == {root}:
        score = 90  # "UCLA" for ucla.edu
    elif any(w <= toks for w in want):
        # Every word of the school's name plus extras: "UCLA Extension", "... - Center of Academic Innovation".
        extra = toks - full
        score = 50 - 5 * len(extra) - 30 * len(extra & _SUBUNIT_WORDS)
    elif len(toks) >= 2 and toks <= full:
        # A shorter form of the name ("University of Virginia" for "..., Charlottesville"); only
        # trusted together with a host on the school's own domain or <root>.instructure.com.
        score = 25
    else:
        return 0
    if host == domain or host.endswith("." + domain):
        score += 40  # on the school's own domain
    elif host == f"{root}.instructure.com":
        score += 30
    elif host.startswith(root):
        score += 10
    return max(score, 0)


async def _canvas_directory(client: httpx.AsyncClient, term: str) -> list[dict]:
    try:
        r = await client.get(CANVAS_SEARCH, params={"name": term, "per_page": 50}, timeout=PROBE_TIMEOUT + 2)
        if r.status_code != 200:
            return []
        return [x for x in r.json() if isinstance(x, dict) and x.get("domain")]
    except Exception:
        return []


CANVAS_MIN_SCORE = 60


def pick_canvas(rows: list[dict], name: str, domain: str, own_host: str | None, root_host: str | None,
                brightspace_found: bool = False) -> tuple[str, str] | None:
    """Best Canvas host for a school from directory rows + probes, as (host, source), or None."""
    root = domain.split(".")[-2] if domain.count(".") >= 1 else domain
    want = _want_tokens(name)
    scored: dict[str, int] = {}
    for row in rows:
        host = row["domain"].lower()
        scored[host] = max(scored.get(host, 0), _score_canvas_row(row, want, root, domain))
    best = max(scored.items(), key=lambda kv: kv[1], default=(None, 0))
    candidates: list[tuple[int, str, str]] = []
    if best[0] and best[1] >= CANVAS_MIN_SCORE:
        candidates.append((best[1], best[0], "canvas_search"))
    if own_host:
        # canvas.<domain> answered as Canvas: the school's own address for it, very likely the real one.
        candidates.append((120, own_host, "probe"))
    if root_host and (scored.get(root_host, 0) >= CANVAS_MIN_SCORE or not (candidates or brightspace_found)):
        # Schools keep unused <root>.instructure.com accounts (trials, Catalog), so on its own it is a
        # last resort, and never outranks a Brightspace site we confirmed.
        candidates.append((scored.get(root_host, 0) or 65, root_host, "probe"))
    if not candidates:
        return None
    _, host, source = max(candidates, key=lambda c: c[0])
    return host, source


async def _current_domain(domain: str) -> str | None:
    """The .edu a school's old domain now redirects to (utd.edu -> utdallas.edu), if any. Our school
    list is years old and some schools have moved, so every LMS guess on the old domain misses."""
    try:
        async with httpx.AsyncClient(follow_redirects=True, max_redirects=5, headers={"User-Agent": "classmate/1.0 (+https://tryclassmate.com)"}) as client:
            r = await client.get(f"https://{domain}/", timeout=PROBE_TIMEOUT)
        host = (r.url.host or "").lower()
    except Exception:
        return None
    parts = host.split(".")
    if len(parts) < 2 or parts[-1] != "edu":
        return None
    new = ".".join(parts[-2:])
    if new == domain or not await asyncio.to_thread(_public_host, new):
        return None
    return new


async def detect(domain: str, name: str) -> list[dict]:
    """Every LMS we can confirm for the school, best first. If nothing turns up on the school's
    domain from our list, try the domain it now redirects to."""
    found = await _detect_on(domain, name)
    if not found:
        moved = await _current_domain(domain)
        if moved:
            found = await _detect_on(moved, name)
    return found


async def _detect_on(domain: str, name: str) -> list[dict]:
    root = domain.split(".")[-2] if domain.count(".") >= 1 else domain
    # Canvas's directory lists schools under their full name, the part before " - " ("University of
    # Michigan - Ann Arbor"), or the abbreviation students use ("UCLA"), so ask all three.
    terms = list(dict.fromkeys(t for t in (name, name.split(" - ")[0], root) if t.strip()))
    async with httpx.AsyncClient(follow_redirects=False, headers={"User-Agent": "classmate/1.0 (+https://tryclassmate.com)"}) as client:
        bs_hosts = _brightspace_candidates(domain)
        bb_hosts = _blackboard_candidates(domain)
        results = await asyncio.gather(
            *[_is_brightspace(client, h) for h in bs_hosts],
            *[_canvas_directory(client, t) for t in terms],
            _is_canvas(client, f"canvas.{domain}", follow=True),
            _is_canvas(client, f"{root}.instructure.com"),
            *[_is_blackboard(client, h) for h in bb_hosts],
        )
    found: list[dict] = []
    for host, ok in zip(bs_hosts, results[: len(bs_hosts)]):
        if ok:
            found.append(lms_option("brightspace", host, "probe"))
            break  # the first (most specific) Brightspace host is the one students use
    rest = results[len(bs_hosts):]
    rows = [row for lst in rest[: len(terms)] for row in lst]
    own_host, root_host = rest[len(terms)], rest[len(terms) + 1]
    bb_found = rest[len(terms) + 2:]
    blackboard_host = next((h for h, ok in zip(bb_hosts, bb_found) if ok), None)
    if own_host and own_host != f"canvas.{domain}" and not await asyncio.to_thread(_public_host, own_host):
        own_host = None  # a redirect to a private address is never a school's Canvas
    # A confirmed Brightspace or Blackboard outranks a bare, unlisted <root>.instructure.com account.
    picked = pick_canvas(rows, name, domain, own_host, root_host, brightspace_found=bool(found) or bool(blackboard_host))
    if picked:
        option = lms_option("canvas", picked[0], picked[1])
        # An LMS on the school's own domain is the one in use; otherwise put Canvas first.
        own_bs = found and found[0]["host"].endswith("." + domain)
        found = found + [option] if own_bs else [option] + found
    if blackboard_host:
        # Schools moving to Canvas/Brightspace often leave Blackboard running for a while, so it
        # leads only when nothing else turned up.
        found.append(lms_option("blackboard", blackboard_host, "probe"))
    return found


def _public_host(host: str) -> bool:
    """Refuse hosts that resolve to private/loopback/link-local addresses (no probing our own network)."""
    try:
        infos = socket.getaddrinfo(host, 443, proto=socket.IPPROTO_TCP)
    except Exception:
        return False
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            return False
    return True


def host_from_input(text: str) -> str | None:
    """'https://lms.school.edu/d2l/home' or 'lms.school.edu' -> 'lms.school.edu'."""
    t = (text or "").strip()
    if not t:
        return None
    if "://" not in t:
        t = "https://" + t
    host = (urlparse(t).hostname or "").lower()
    if not re.fullmatch(r"[a-z0-9.-]+\.[a-z]{2,}", host):
        return None
    return host


async def identify(host: str) -> dict | None:
    """What LMS runs at a host a student typed in (Brightspace, Canvas or Blackboard), or None."""
    if not await asyncio.to_thread(_public_host, host):
        return None
    async with httpx.AsyncClient(follow_redirects=False, headers={"User-Agent": "classmate/1.0 (+https://tryclassmate.com)"}) as client:
        bs, cv, bb = await asyncio.gather(_is_brightspace(client, host), _is_canvas(client, host), _is_blackboard(client, host))
    if bs:
        return lms_option("brightspace", host, "manual")
    if cv:
        return lms_option("canvas", host, "manual")
    if bb:
        return lms_option("blackboard", host, "manual")
    return None


# ── Logos ──────────────────────────────────────────────────────────────────
# A school's best square icon: whatever its homepage declares (apple-touch-icon / icon links),
# its /apple-touch-icon.png, or Google's favicon service, keeping the largest real PNG/JPEG.
# Resolved once per school and remembered for the life of the process.

_logo_cache: dict[str, str | None] = {}
_ICON_LINK_RE = re.compile(r"<link\b[^>]*>", re.I)
MIN_LOGO_PX = 48


def _image_size(data: bytes) -> int:
    """Smaller side in px for PNG/JPEG bytes, 0 if it isn't one we can read."""
    if data[:8] == b"\x89PNG\r\n\x1a\n" and len(data) >= 24:
        w, h = int.from_bytes(data[16:20], "big"), int.from_bytes(data[20:24], "big")
        return min(w, h)
    if data[:4] == b"\x00\x00\x01\x00" and len(data) >= 6:  # .ico: largest entry (0 means 256)
        count = int.from_bytes(data[4:6], "little")
        sizes = [(data[6 + 16 * k] or 256) for k in range(min(count, 16)) if 6 + 16 * k < len(data)]
        return max(sizes, default=0)
    if data[:2] == b"\xff\xd8":
        i = 2
        while i + 9 < len(data):
            if data[i] != 0xFF:
                i += 1
                continue
            marker, seg = data[i + 1], int.from_bytes(data[i + 2:i + 4], "big")
            if marker in (0xC0, 0xC1, 0xC2):
                h, w = int.from_bytes(data[i + 5:i + 7], "big"), int.from_bytes(data[i + 7:i + 9], "big")
                return min(w, h)
            i += 2 + seg
    return 0


def _icon_links(html: str, base: str) -> list[str]:
    out = []
    for tag in _ICON_LINK_RE.findall(html[:300_000]):
        rel = re.search(r'rel=["\']([^"\']+)', tag, re.I)
        href = re.search(r'href=["\']([^"\']+)', tag, re.I)
        if not rel or not href or "icon" not in rel.group(1).lower():
            continue
        url = href.group(1).strip()
        if url.startswith("//"):
            url = "https:" + url
        elif url.startswith("/"):
            url = base + url
        elif not url.startswith("http"):
            url = base + "/" + url
        if not url.lower().split("?")[0].endswith(".svg"):
            out.append(url)
    return out


# Wikidata has the official logo for most colleges (P154) and, through the athletics program that
# "represents" the school (P1268), its athletics mark: the square logo students actually know
# (Clemson's paw, the CofC Cougars). Images are served by Wikimedia Commons, rendered to PNG.
WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"
_wikidata_cache: dict[str, dict] = {}
_UA = {"User-Agent": "classmate/1.0 (https://tryclassmate.com; support@tryclassmate.com)"}


def _commons_png(file_url: str, width: int) -> str:
    name = file_url.rsplit("/", 1)[-1]
    return f"https://commons.wikimedia.org/wiki/Special:FilePath/{name}?width={width}"


def _mark_score(file_url: str) -> int:
    n = file_url.rsplit("/", 1)[-1].lower()
    score = 0
    if "logo" in n or "logomark" in n:
        score += 2
    if any(w in n for w in ("wordmark", "woodmark", "script", "text", "word")):
        score -= 3
    return score


async def wikidata_logos(domain: str) -> dict:
    """{'square': url|None, 'wide': url|None} from Wikidata, matched on the school's official website."""
    if domain in _wikidata_cache:
        return _wikidata_cache[domain]
    sites = " ".join(f"<{p}://{w}{domain}{s}>" for p in ("https", "http") for w in ("www.", "") for s in ("/", ""))
    query = f"""SELECT ?wide ?mark WHERE {{
      VALUES ?site {{ {sites} }} ?u wdt:P856 ?site .
      OPTIONAL {{ ?u wdt:P154 ?wide }}
      OPTIONAL {{ ?team wdt:P1268 ?u ; wdt:P154 ?mark }} }} LIMIT 40"""
    out = {"square": None, "wide": None}
    try:
        async with httpx.AsyncClient(timeout=12.0, headers=_UA) as client:
            r = await client.get(WIKIDATA_SPARQL, params={"query": query, "format": "json"})
        rows = r.json()["results"]["bindings"] if r.status_code == 200 else []
        marks = sorted({x["mark"]["value"] for x in rows if "mark" in x}, key=_mark_score, reverse=True)
        wides = sorted({x["wide"]["value"] for x in rows if "wide" in x})
        if marks and _mark_score(marks[0]) >= 0:
            out["square"] = _commons_png(marks[0], 256)
        if wides:
            out["wide"] = _commons_png(wides[0], 600)
    except Exception:
        return out  # not cached: try again next time
    _wikidata_cache[domain] = out
    return out


async def logo_url(domain: str, kind: str = "square") -> str | None:
    """Best logo for a school. square: athletics mark -> site icon; wide: official logo."""
    wd = await wikidata_logos(domain)
    if kind == "wide":
        return wd["wide"]
    return wd["square"] or await site_icon_url(domain)


async def site_icon_url(domain: str) -> str | None:
    if domain in _logo_cache:
        return _logo_cache[domain]
    best: tuple[int, str | None] = (0, None)
    async with httpx.AsyncClient(follow_redirects=True, timeout=5.0,
                                 headers={"User-Agent": "Mozilla/5.0 (compatible; classmate/1.0; +https://tryclassmate.com)"}) as client:
        candidates: list[str] = []
        for base in (f"https://www.{domain}", f"https://{domain}"):
            try:
                r = await client.get(base + "/")
                if r.status_code == 200 and "html" in r.headers.get("content-type", ""):
                    candidates += _icon_links(r.text, str(r.url).rstrip("/").split("/", 3)[0] + "//" + str(r.url).split("/")[2])
                    break
            except Exception:
                continue
        candidates += [f"https://www.{domain}/apple-touch-icon.png", f"https://{domain}/apple-touch-icon.png",
                       f"https://www.google.com/s2/favicons?domain={domain}&sz=256", f"https://www.{domain}/favicon.ico"]

        async def size_of(url: str) -> tuple[int, str]:
            try:
                r = await client.get(url)
                if r.status_code != 200 or len(r.content) > 2_000_000:
                    return 0, url
                return _image_size(r.content), str(r.url)
            except Exception:
                return 0, url

        for px, url in await asyncio.gather(*[size_of(u) for u in dict.fromkeys(candidates[:12])]):
            if px > best[0]:
                best = (px, url)
    url = best[1] if best[0] >= MIN_LOGO_PX else None
    _logo_cache[domain] = url
    return url
