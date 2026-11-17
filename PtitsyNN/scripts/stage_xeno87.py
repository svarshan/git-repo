#!/usr/bin/env python3
"""Stage redistributable Xeno-canto recordings as OFFLINE UNVERIFIED listening previews.

Never changes app/data.js, audioFile/audioCredits, or original media/audio.
Requires API key, exact scientific species, free media license and real FFmpeg QA.
The pre-existing 265 catalog voices remain the only counted primary voices.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import time
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from xeno_candidates87 import catalog_missing, accepted_license, query_page

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app"
PREVIEWS = APP / "media" / "audio-candidates87"
OUT = ROOT / "dist" / "release-evidence"
NAME = "candidate-voices87.js"
ALIAS = {
    "Bubo scandiacus": ["Nyctea scandiaca"],
    "Tachyspiza brevipes": ["Accipiter brevipes"],
    "Calidris pugnax": ["Philomachus pugnax"],
    "Eudromias morinellus": ["Charadrius morinellus"],
    "Ichthyaetus ichthyaetus": ["Larus ichthyaetus"],
    "Poecile cinctus": ["Parus cinctus"],
}
MAX_DOWNLOAD_BYTES = 13_000_000
MAX_PREVIEW_SECONDS = 45
ALLOWED_HOSTS = {"xeno-canto.org", "www.xeno-canto.org", "xeno-canto.s3.amazonaws.com"}
BAD_NOTES = re.compile(r"\b(human voices?|speech|talking|conversation|imitation|imitation of|soundscape|mixed chorus|interview|voiceover|playback)\b", re.I)
VOCAL_TYPES = re.compile(r"\b(song|call|vocal|alarm|flight|cry|croak|begging)\b", re.I)


def ffmpeg_path():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return "ffmpeg"


def check_recording(rec, taxon):
    if not isinstance(rec, dict):
        return None
    genus, species = taxon.casefold().split()
    if str(rec.get("gen", "")).casefold() != genus or str(rec.get("sp", "")).casefold() != species:
        return None
    license_url = accepted_license(rec.get("lic"))
    rid = str(rec.get("id") or "")
    author = str(rec.get("rec") or "").strip()
    quality = str(rec.get("q") or "").upper()
    source = str(rec.get("file") or "").strip()
    soundtype = str(rec.get("type") or "")
    if not license_url or not rid.isdecimal() or not author or quality not in {"A", "B", "C"}:
        return None
    if not VOCAL_TYPES.search(soundtype):
        return None
    also = rec.get("also")
    if isinstance(also, list) and any(str(x).strip() for x in also):
        return None
    if isinstance(also, str) and also.strip() not in ("", "[]"):
        return None
    if str(rec.get("playback-used") or rec.get("playbackUsed") or "").casefold() in {"yes", "true"}:
        return None
    if str(rec.get("id-questioned") or "").casefold() in {"yes", "true"}:
        return None
    remarks = str(rec.get("rmk") or "")
    if BAD_NOTES.search(remarks + " " + soundtype):
        return None
    if source.startswith("//"):
        source = "https:" + source
    parsed = urlparse(source)
    if parsed.scheme != "https" or parsed.hostname not in ALLOWED_HOSTS:
        return None
    return {"recordingId": "XC" + rid, "id": rid, "url": source,
            "source": "https://xeno-canto.org/" + rid,
            "sourceTaxon": taxon, "license": license_url, "author": author[:200],
            "quality": quality, "type": soundtype[:120], "originalLength": str(rec.get("length") or "")[:30],
            "also": [], "speechOrExtraSpeciesReviewed": False, "speciesHumanVerified": False}


def ranked_candidates(latin):
    found = {}
    for alias in [latin] + ALIAS.get(latin, []):
        try:
            response = query_page(alias, 1)
        except RuntimeError as error:
            print("XENO QUERY WARNING", latin, type(error).__name__, str(error)[:120], flush=True)
            continue
        for rec in response.get("recordings", []):
            item = check_recording(rec, alias)
            if item:
                found[item["id"]] = item
        time.sleep(0.30)
    return sorted(found.values(),
                  key=lambda r: ({"A":0, "B":1, "C":2}[r["quality"]],
                                 0 if "song" in r["type"].lower() else 1,
                                 0 if "zero/1.0" in r["license"] else 1,
                                 -min(45, duration_seconds(r["originalLength"])),
                                 int(r["id"])))


def duration_seconds(value):
    s = str(value or "")
    try:
        a = [int(x) for x in s.split(":")]
        return a[-1] + a[-2] * 60 + (a[-3] * 3600 if len(a)>2 else 0) if len(a)>=2 else int(s)
    except (ValueError, IndexError):
        return 0


def download_source(url, destination):
    req = Request(url, headers={"User-Agent":"MoOLVaBirdAtlas/8.7 (authorized licensed bird recordings; github.com/svarshan/git-repo)"})
    with urlopen(req, timeout=35) as response:
        final = urlparse(response.geturl())
        if final.scheme != "https" or final.hostname not in ALLOWED_HOSTS:
            raise ValueError("Unexpected download redirect host")
        if int(response.headers.get("Content-Length") or 0) > MAX_DOWNLOAD_BYTES:
            raise ValueError("Recording too large")
        total = 0
        with destination.open("wb") as stream:
            while True:
                chunk = response.read(131072)
                if not chunk:
                    break
                total += len(chunk)
                if total > MAX_DOWNLOAD_BYTES:
                    raise ValueError("Recording exceeds size limit")
                stream.write(chunk)
    if total < 3500:
        raise ValueError("Recording too small")
    return total


def transcode(source, target, ffmpeg):
    cmd = [ffmpeg, "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
           "-i", str(source), "-t", str(MAX_PREVIEW_SECONDS),
           "-vn", "-ac", "1", "-ar", "32000", "-c:a", "libmp3lame", "-q:a", "4", str(target)]
    p = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=85)
    if p.returncode or not target.exists() or target.stat().st_size < 3000:
        raise ValueError("FFmpeg could not produce an audible MP3 excerpt")


def verify_audio(target):
    from audit_audio import inspect
    return inspect(target)


def stage_all(minimum=1):
    if not os.getenv("XENO_CANTO_API_KEY", "").strip():
        raise RuntimeError("XENO_CANTO_API_KEY missing from workflow environment")
    species = catalog_missing()
    if len(species) != 33:
        raise ValueError("Baseline 265/298 has changed; stop")
    PREVIEWS.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    ffmpeg = ffmpeg_path()
    evidence, failures = [], []
    for ix,(latin,name) in enumerate(species, 1):
        selected = None
        candidates = ranked_candidates(latin)
        for item in candidates[:5]:
            fname = latin.casefold().replace(" ", "-") + "-xc" + item["id"] + ".mp3"
            dest = PREVIEWS / fname
            try:
                with tempfile.TemporaryDirectory() as temp:
                    raw = Path(temp) / "recording.bin"
                    download_source(item["url"], raw)
                    transcode(raw, dest, ffmpeg)
                metrics = verify_audio(dest)
                blob = dest.read_bytes()
                digest = hashlib.sha256(blob).hexdigest()
                # Cross-species duplicate audio is not admissible.
                if any(x["sha256"] == digest for x in evidence):
                    raise ValueError("Same audio already staged for another species")
                item.update({"latin":latin,"name":name,"file":"media/audio-candidates87/"+fname,
                             "sha256":digest,"bytes":len(blob),"metrics":metrics,
                             "state":"requires-independent-listening",
                             "note":"Real licensed recording preview, technical checks only; not confirmed by a human ornithologist."})
                selected = item
                evidence.append(item)
                break
            except (OSError, ValueError, subprocess.TimeoutExpired) as exc:
                dest.unlink(missing_ok=True)
                print("REJECT CANDIDATE", latin, item["recordingId"], str(exc)[:130], flush=True)
            except Exception as exc:
                dest.unlink(missing_ok=True)
                print("SOURCE DOWNLOAD ERROR", latin, item["recordingId"], type(exc).__name__, flush=True)
        if not selected:
            failures.append({"latin":latin, "name":name, "reason":"no downloaded candidate passed strict source and technical checks",
                             "availableMetadataCandidates":len(candidates)})
        print(f"{ix:02d}/33 {latin} -> " + (selected["recordingId"] if selected else "not staged"), flush=True)
    clean=[{k:v for k,v in x.items() if k!="url"} for x in evidence]
    payload={"schema":1,"species":298,"baselinePrimaryVoices":265,"previewFiles":len(clean),
             "manualVerified":0,"source":"Xeno-canto v3","entries":clean,"failed":failures,
             "policy":"Review-only recordings: NOT counted as main bird calls. Human listening and taxon validation are pending."}
    (OUT/"voice-candidates87.json").write_text(json.dumps(payload,ensure_ascii=False,indent=2), encoding="utf-8")
    (APP/NAME).write_text("window.MOOLVA_CANDIDATE_VOICES87="+json.dumps(clean,ensure_ascii=False,separators=(",",":"))+";\n",encoding="utf-8")
    print("STAGING COMPLETE", json.dumps({"previewFiles":len(clean),"notStaged":len(failures),
          "baselineUnchanged":265,"manualVerified":0},ensure_ascii=False),flush=True)
    if len(clean)<minimum:
        raise RuntimeError("Fewer than "+str(minimum)+" recordings staged: no valid new preview release")
    return payload


if __name__ == "__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--min",dest="minimum",type=int,default=1)
    args=p.parse_args()
    stage_all(max(1,args.minimum))
