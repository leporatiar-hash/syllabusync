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
PROBE_TIMEOUT = 4.0

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
    return {"brightspace": "Brightspace", "canvas": "Canvas"}.get(provider or "", "your LMS")


def lms_option(provider: str, host: str, source: str) -> dict:
    return {"provider": provider, "host": host, "name": brand(host, provider), "source": source}


def _brightspace_candidates(domain: str) -> list[str]:
    root = domain.split(".")[-2] if domain.count(".") >= 1 else domain
    return [
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


async def _is_canvas(client: httpx.AsyncClient, host: str) -> bool:
    """Canvas answers an unauthenticated API call with a 401 JSON body naming the problem."""
    try:
        r = await client.get(f"https://{host}/api/v1/users/self", timeout=PROBE_TIMEOUT)
        return r.status_code == 401 and "unauthenticated" in r.text.lower()
    except Exception:
        return False


async def _canvas_by_name(client: httpx.AsyncClient, name: str) -> str | None:
    try:
        r = await client.get(CANVAS_SEARCH, params={"name": name, "per_page": 20}, timeout=PROBE_TIMEOUT + 2)
        if r.status_code != 200:
            return None
        want = _norm(name)
        rows = [x for x in r.json() if isinstance(x, dict) and x.get("domain")]
        exact = [x for x in rows if _norm(x.get("name", "")) == want]
        close = [x for x in rows if want in _norm(x.get("name", ""))]
        pick = (exact or close or [None])[0]
        return pick["domain"].lower() if pick else None
    except Exception:
        return None


async def detect(domain: str, name: str) -> list[dict]:
    """Every LMS we can confirm for the school, best first."""
    root = domain.split(".")[-2] if domain.count(".") >= 1 else domain
    async with httpx.AsyncClient(follow_redirects=False, headers={"User-Agent": "ClassMate/1.0 (+https://tryclassmate.com)"}) as client:
        bs_hosts = _brightspace_candidates(domain)
        results = await asyncio.gather(
            *[_is_brightspace(client, h) for h in bs_hosts],
            _canvas_by_name(client, name.split(" - ")[0]),
            _is_canvas(client, f"{root}.instructure.com"),
            _is_canvas(client, f"canvas.{domain}"),
        )
    found: list[dict] = []
    for host, ok in zip(bs_hosts, results[: len(bs_hosts)]):
        if ok:
            found.append(lms_option("brightspace", host, "probe"))
            break  # the first (most specific) Brightspace host is the one students use
    canvas_named, canvas_root, canvas_sub = results[len(bs_hosts):]
    # Schools often keep an unused <root>.instructure.com account (trials, Canvas Catalog), so a
    # bare instructure.com host only counts when nothing else turned up.
    canvas_host = canvas_named or (f"canvas.{domain}" if canvas_sub else None) or (
        f"{root}.instructure.com" if canvas_root and not found else None)
    if canvas_host:
        option = lms_option("canvas", canvas_host, "canvas_search" if canvas_named else "probe")
        # An LMS on the school's own domain is the one in use; otherwise trust Canvas's directory.
        own_bs = found and found[0]["host"].endswith("." + domain)
        found = found + [option] if own_bs else [option] + found
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
    """What LMS runs at a host a student typed in (Brightspace or Canvas), or None."""
    if not await asyncio.to_thread(_public_host, host):
        return None
    async with httpx.AsyncClient(follow_redirects=False, headers={"User-Agent": "ClassMate/1.0 (+https://tryclassmate.com)"}) as client:
        bs, cv = await asyncio.gather(_is_brightspace(client, host), _is_canvas(client, host))
    if bs:
        return lms_option("brightspace", host, "manual")
    if cv:
        return lms_option("canvas", host, "manual")
    return None
