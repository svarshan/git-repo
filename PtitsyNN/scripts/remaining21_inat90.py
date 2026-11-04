#!/usr/bin/env python3
"""Independent final-pass retrieval of licensed iNaturalist bird sounds.

Only exact Research Grade taxon observations and independently licensed sound
files (CC0, CC BY, CC BY-SA) can be included. All newly added sounds remain
marked as not human-verified. Historical 265 audio SHA-256 hashes are invariant.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import tempfile
import time
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

from attach_voices88 import APP, ROOT, CAT, COVERAGE, OUT, read_catalog, filehash, promote, safe_inat_download
from stage_xeno87 import ffmpeg_path, transcode, verify_audio

API = "https://api.inaturalist.org/v1/observations"
UA = "MoOLVaBirdAtlas/8.6 (licensed recordings, github.com/svarshan/git-repo)"
LICENSES = {
    "cc0": "https://creativecommons.org/publicdomain/zero/1.0/",
    "cc-by": "https://creativecommons.org/licenses/by/4.0/",
    "cc-by-sa": "https://creativecommons.org/licenses/by-sa/4.0/",
}
BAD = re.compile(r"human voice|human speech|people talking|conversation|narration|voiceover|pronunciation|playback|other species|wrong species|identification uncertain", re.I)
MAX_SECONDS = 510
REPORT = OUT / "remaining-voices90.json"


def candidate(observation, sound, latin):
    """Never inherit an observation's license as the sound-file license."""
    if not isinstance(observation, dict) or not isinstance(sound, dict):
        return None
    if str(observation.get("quality_grade", "")).lower() != "research":
        return None
    observed_taxon = observation.get("taxon") or {}
    if str(observed_taxon.get("name") or "").casefold() != latin.casefold():
        return None
    lic_code = str(sound.get("license_code") or "").lower().strip()
    license_url = LICENSES.get(lic_code)
    if not license_url:
        return None
    sound_id = str(sound.get("id") or "")
    observation_id = str(observation.get("id") or "")
    if not sound_id.isdecimal() or not observation_id.isdecimal():
        return None
    url = str(sound.get("file_url") or "").strip()
    if url.startswith("//"):
        url = "https:" + url
    parsed = urlparse(url)
    host = parsed.hostname or ""
    if parsed.scheme != "https" or not (
        host == "inaturalist.org" or host.endswith(".inaturalist.org") or
        host == "inaturalist-open-data.s3.amazonaws.com"
    ):
        return None
    author = str(sound.get("attribution") or "").strip()
    if not author:
        # iNaturalist observations are user-submitted, but the recording author
        # is not provable if the sound itself lacks attribution.
        return None
    if len(author) > 240:
        return None
    notes = str(observation.get("description") or "") + " " + str(sound.get("description") or "")
    if BAD.search(notes[:1200]):
        return None
    return {
        "recordingId": "iNat:" + sound_id,
        "sourcePlatform": "iNaturalist",
        "sourceTaxon": latin,
        "source": "https://www.inaturalist.org/observations/" + observation_id,
        "url": url,
        "author": author,
        "licenseCode": lic_code.upper(),
        "license": license_url,
        "soundId": int(sound_id),
        "quality": "research-grade observation; sound recording unverified by human",
        "type": "Real-world observation audio (identity requires user review)",
    }


def fetch_page(latin, page):
    query = urlencode({
        "taxon_name": latin,
        "quality_grade": "research",
        "sounds": "true",
        "sound_license": "cc0,cc-by,cc-by-sa",
        "per_page": 70,
        "page": page,
        "order": "desc",
        "order_by": "created_at",
    })
    req = Request(API + "?" + query, headers={"User-Agent": UA, "Accept": "application/json"})
    with urlopen(req, timeout=26) as response:
        if response.geturl().split("?", 1)[0] != API:
            raise ValueError("Unexpected iNaturalist API redirect")
        result = json.load(response)
    if not isinstance(result, dict) or not isinstance(result.get("results"), list):
        raise ValueError("Unexpected iNaturalist JSON response")
    return result["results"]


def search(latin, deadline):
    seen = set()
    for page in (1, 2):
        if time.monotonic() > deadline:
            break
        try:
            observations = fetch_page(latin, page)
        except Exception as error:
            print("INAT90 QUERY", latin, page, type(error).__name__, str(error)[:110], flush=True)
            break
        for observation in observations:
            for sound in observation.get("sounds") or []:
                item = candidate(observation, sound, latin)
                if item and item["recordingId"] not in seen:
                    seen.add(item["recordingId"])
                    yield item
        if len(observations) < 70:
            break
        time.sleep(0.55)


def fill(apply=False, max_seconds=MAX_SECONDS):
    birds = read_catalog()
    baseline = json.loads((ROOT / "data" / "voice-baseline85.json").read_text(encoding="utf-8"))
    if baseline.get("count") != 265 or len(baseline.get("records", [])) != 265:
        raise ValueError("Refusing run without historical 265 voice baseline")
    by_taxon = {b["latin"]: b for b in birds}
    for record in baseline["records"]:
        if by_taxon[record["latin"]].get("audioFile") != record["file"]:
            raise ValueError("Historical voice association changed: " + record["latin"])
        if filehash(APP / record["file"]) != record["sha256"]:
            raise ValueError("Historical voice hash changed: " + record["latin"])
    previously_present = sum(bool(b.get("audioFile")) for b in birds)
    hashes = {filehash(APP / b["audioFile"]) for b in birds if b.get("audioFile")}
    missing = [(b["latin"], b["name"]) for b in birds if not b.get("audioFile")]
    deadline = time.monotonic() + max_seconds
    imported, failed = [], []
    for index, (latin, russian) in enumerate(missing, 1):
        if time.monotonic() >= deadline:
            failed.append({"latin":latin,"reason":"Time budget expired; no recording added"})
            continue
        matched = None
        for item in search(latin, deadline):
            if time.monotonic() >= deadline:
                break
            try:
                with tempfile.TemporaryDirectory() as folder:
                    src = Path(folder) / "source.bin"
                    mp3 = Path(folder) / "converted.mp3"
                    safe_inat_download(item["url"], src)
                    transcode(src, mp3, ffmpeg_path())
                    metrics = verify_audio(mp3)
                    digest = filehash(mp3)
                    if digest in hashes:
                        raise ValueError("Duplicate sound assigned to another bird")
                    if apply:
                        matched = promote(by_taxon[latin], item, mp3, hashes, metrics)
                        by_taxon[latin]["audioCredits"]["speciesMatch"] = (
                            "Exact Research Grade taxon; independently unverified sound identity"
                        )
                        by_taxon[latin]["audioCredits"]["audioProcessing"] = (
                            "Original iNaturalist sound trimmed to at most 45 s and transcoded to mono MP3 32 kHz"
                        )
                    else:
                        hashes.add(digest)
                        matched = {"latin":latin,"name":russian,"source":item["source"],
                                   "license":item["license"],"sha256":digest}
                break
            except Exception as exc:
                print("INAT90 REJECT", latin, item["recordingId"], type(exc).__name__,
                      str(exc)[:125], flush=True)
        if matched:
            imported.append(matched)
        else:
            failed.append({"latin":latin,"reason":"No available exact-taxon, distributable, technically valid sound"})
        print("INAT90 %02d/%02d %s %s" % (
            index, len(missing), latin, "added" if matched else "missing"), flush=True)
    if apply:
        for record in baseline["records"]:
            if filehash(APP / record["file"]) != record["sha256"]:
                raise ValueError("Historical archive corrupted")
        current_count = sum(bool(b.get("audioFile")) for b in birds)
        if current_count != previously_present + len(imported):
            raise ValueError("False coverage count in iNaturalist addition")
        CAT.write_text("window.BIRDS_DATA=" + json.dumps(birds, ensure_ascii=False, separators=(",",":"))+";",
                       encoding="utf-8")
        coverage = json.loads(COVERAGE.read_text(encoding="utf-8"))
        coverage["birdCalls"] = current_count
        coverage["missingAudio"] = [b["latin"] for b in birds if not b.get("audioFile")]
        coverage["inatFinalPass90"] = {"newVoices":len(imported), "remaining":298-current_count,
                                       "humanReviewedNew":0}
        for key in ("milestone150","milestone200","milestone250","milestone298"):
            if isinstance(coverage.get(key),dict):
                goal=int(coverage[key].get("target") or key.replace("milestone",""))
                coverage[key].update(verifiedAudioSpecies=current_count,
                                     shortfall=max(0, goal-current_count),
                                     achieved=current_count>=goal)
        COVERAGE.write_text(json.dumps(coverage,ensure_ascii=False,indent=2),encoding="utf-8")
    else:
        current_count = previously_present
    output={"target":298,"startedWith":previously_present,"newVoices":len(imported),
            "after":current_count,"remaining":298-current_count if apply else len(missing),
            "historical265Preserved":True,"humanVerifiedNew":0,
            "recordings":imported,"unfilledSpecies":failed}
    OUT.mkdir(parents=True,exist_ok=True)
    REPORT.write_text(json.dumps(output,ensure_ascii=False,indent=2),encoding="utf-8")
    print("INAT90 FINAL PASS", json.dumps(
        {"new":len(imported),"after":current_count,"remaining":298-current_count,"original265Unchanged":True},
        ensure_ascii=False),flush=True)
    return output


if __name__=="__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply",action="store_true")
    parser.add_argument("--seconds",type=int,default=MAX_SECONDS)
    args = parser.parse_args()
    fill(apply=args.apply,max_seconds=min(800,max(20,args.seconds)))
