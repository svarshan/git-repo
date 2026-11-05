#!/usr/bin/env python3
"""Read-only Xeno-canto v3 discovery for the 33 missing MoOLVa bird calls.

Searches exact species (plus documented taxonomic synonyms), filters sound-level
redistribution licenses, and exports review-only evidence. Never downloads or
automatically approves recordings and never alters the 265-audio baseline.
"""
import base64
import csv
import json
import os
from pathlib import Path
import re
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen
import zlib

ROOT = Path(__file__).resolve().parents[1]
API = "https://xeno-canto.org/api/3/recordings"
KEY = os.environ.get("XENO_CANTO_API_KEY", "").strip()
USER_AGENT = "MoOLVaBirdAtlas/8.7 (licensed metadata discovery; github.com/svarshan/git-repo)"
ALIASES = {
    "Bubo scandiacus": ["Nyctea scandiaca"],
    "Tachyspiza brevipes": ["Accipiter brevipes"],
    "Calidris pugnax": ["Philomachus pugnax"],
    "Eudromias morinellus": ["Charadrius morinellus"],
    "Ichthyaetus ichthyaetus": ["Larus ichthyaetus"],
    "Poecile cinctus": ["Parus cinctus"],
}
LIC_URL = re.compile(r"^/licenses/(by|by-sa)/(?:2\.0|2\.5|3\.0|4\.0)/?$")
CC0_URL = re.compile(r"^/publicdomain/zero/1\.0/?$")
FIELDS = ("latin", "name", "status", "source_latin", "recording_id",
          "source_url", "license", "author", "quality", "type", "duration",
          "review_notes")


def catalog_missing():
    packed = "".join((ROOT / "data" / "species.b64").read_text(encoding="ascii").split())
    pairs = [row.split("|", 1) for row in zlib.decompress(base64.b64decode(packed)).decode("utf-8").splitlines()]
    if len(pairs) != 298 or any(len(pair) != 2 for pair in pairs):
        raise ValueError("Expected exactly 298 species in the source catalog")
    by_latin = {latin: name for name, latin in pairs}
    baseline = json.loads((ROOT / "data" / "voice-baseline85.json").read_text(encoding="utf-8"))
    kept = {row["latin"] for row in baseline["records"]}
    if len(by_latin) != 298 or baseline.get("count") != 265 or len(kept) != 265 or not kept <= by_latin.keys():
        raise ValueError("Baseline mismatch; refusing to search against an unreliable species list")
    missing = sorted(set(by_latin) - kept)
    if len(missing) != 33:
        raise ValueError("Expected 33 missing species, not " + str(len(missing)))
    return [(latin, by_latin[latin]) for latin in missing]


def accepted_license(value):
    raw = str(value or "").strip()
    if raw.startswith("//"):
        raw = "https:" + raw
    parsed = urlparse(raw)
    if parsed.scheme not in ("http", "https") or parsed.hostname not in (
            "creativecommons.org", "www.creativecommons.org"):
        return ""
    if LIC_URL.fullmatch(parsed.path) or CC0_URL.fullmatch(parsed.path):
        return "https://creativecommons.org" + parsed.path
    return ""


def parse_candidate(record, source_latin):
    if not isinstance(record, dict):
        return None
    parts = source_latin.casefold().split()
    if len(parts) != 2 or str(record.get("gen", "")).casefold() != parts[0] or \
            str(record.get("sp", "")).casefold() != parts[1]:
        return None
    license_url = accepted_license(record.get("lic"))
    ident = str(record.get("id") or "")
    author = str(record.get("rec") or "").strip()
    if not license_url or not ident.isdecimal() or not author or not record.get("file"):
        return None
    comment = " ".join(str(record.get(field) or "") for field in ("rmk", "type", "also"))
    hints = []
    if re.search(r"human|speech|talking|voice.?over|interview|imitation|soundscape|background|other species", comment, re.I):
        hints.append("review possible other sounds or speech")
    if record.get("q") not in ("A", "B"):
        hints.append("review recording quality")
    return {
        "source_latin": source_latin,
        "recording_id": ident,
        "source_url": "https://xeno-canto.org/" + ident,
        "license": license_url,
        "author": author[:200],
        "quality": str(record.get("q") or "")[:10],
        "type": str(record.get("type") or "")[:120],
        "duration": str(record.get("length") or "")[:20],
        "review_notes": "; ".join(hints) or "not yet listened to or identified independently",
    }


def query_page(latin, page):
    genus, species = latin.split()
    params = urlencode({
        "query": "gen:" + genus + " sp:" + species + " grp:birds",
        "key": KEY,
        "page": page,
        "per_page": 100,
    })
    # Do not log URLs: they contain the private API key.
    request = Request(API + "?" + params,
                      headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        with urlopen(request, timeout=25) as response:
            payload = json.load(response)
    except HTTPError as exc:
        if exc.code in (401, 403):
            raise RuntimeError("Xeno-canto rejected API key or access: HTTP " + str(exc.code)) from None
        raise RuntimeError("Xeno-canto HTTP " + str(exc.code)) from None
    except (URLError, TimeoutError, ValueError) as exc:
        raise RuntimeError("Xeno-canto temporarily unreachable or invalid JSON: " + type(exc).__name__) from None
    if not isinstance(payload, dict) or not isinstance(payload.get("recordings"), list):
        raise RuntimeError("Unexpected Xeno-canto API response")
    return payload


def search_one(latin, name):
    by_id = {}
    queries = list(dict.fromkeys([latin] + ALIASES.get(latin, [])))
    for queried in queries:
        for page in (1, 2):
            data = query_page(queried, page)
            for recording in data["recordings"]:
                candidate = parse_candidate(recording, queried)
                if candidate:
                    by_id[candidate["recording_id"]] = candidate
            if len(data["recordings"]) < 100 or len(by_id) >= 20:
                break
            time.sleep(0.35)
        time.sleep(0.35)
    rows = sorted(by_id.values(), key=lambda r: (
        {"A": 0, "B": 1, "C": 2}.get(r["quality"], 3),
        int(r["recording_id"])))
    for row in rows[:20]:
        row.update(latin=latin, name=name, status="candidate-unreviewed")
    return rows[:20]


def csv_safe(value):
    text = str(value or "")
    return "'" + text if text.startswith(("=", "+", "-", "@", "\t", "\r", "\n")) else text


def main():
    if not KEY:
        raise SystemExit("XENO_CANTO_API_KEY not available to this GitHub Actions job")
    species = catalog_missing()
    outdir = ROOT / "dist" / "xeno-canto-candidates"
    outdir.mkdir(parents=True, exist_ok=True)
    rows, per_species, errors = [], [], []
    for i, (latin, name) in enumerate(species, 1):
        try:
            hits = search_one(latin, name)
            status = "found-unreviewed" if hits else "no-compatible-results"
            rows.extend(hits)
        except RuntimeError as exc:
            status = "search-error"
            hits = []
            errors.append({"latin": latin, "message": str(exc)})
            if "rejected API key" in str(exc):
                raise SystemExit(str(exc)) from None
        per_species.append({"latin": latin, "name": name, "status": status, "candidates": len(hits)})
        print(f"{i:02d}/33 {latin}: {status} ({len(hits)})", flush=True)
        time.sleep(0.4)
    with (outdir / "xeno-canto-candidates.csv").open("w", newline="", encoding="utf-8-sig") as stream:
        writer = csv.DictWriter(stream, fieldnames=FIELDS, delimiter=";")
        writer.writeheader()
        for row in rows:
            writer.writerow({field: csv_safe(row.get(field, "")) for field in FIELDS})
    report = {
        "target": 298, "preserved_original_recordings": 265,
        "missing_species_searched": len(species),
        "species_with_candidates": sum(row["candidates"] > 0 for row in per_species),
        "candidate_recordings": len(rows),
        "errors": errors,
        "disclaimer": "Metadata only. None listened to or identified independently; no files imported.",
        "species": per_species,
        "candidates": rows,
    }
    (outdir / "xeno-canto-candidates.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print("XENO_CANTO_REPORT", json.dumps({
        k: report[k] for k in ("missing_species_searched", "species_with_candidates", "candidate_recordings")
    }), flush=True)
    if errors:
        raise SystemExit(f"{len(errors)} species queries failed. Partial report uploaded by workflow.")


if __name__ == "__main__":
    main()
