#!/usr/bin/env python3
"""Safe discovery and optional addition of Tierstimmenarchiv bird calls.

The archive's public species search and individual detail pages supply the
exact taxon, author, audio endpoint and license. Accept only explicit CC BY /
CC BY-SA URLs, playable original MP3 and FFmpeg QA; never auto-confirm species
by ear and never replace the historical 265 audio recordings.
"""
from __future__ import annotations

import argparse
from html import unescape
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tempfile
import time
from urllib.parse import urlencode, urljoin, urlparse, parse_qs
from urllib.request import Request,urlopen

from xeno_candidates87 import catalog_missing, accepted_license
from attach_voices88 import APP, ROOT, CAT, COVERAGE, OUT, read_catalog, filehash, promote
from stage_xeno87 import transcode, ffmpeg_path, verify_audio

ORIGIN="https://suche.tierstimmenarchiv.de"
UA="MoOLVaBirdAtlas/8.6 (research and licensed audio redistribution; github.com/svarshan/git-repo)"
STAGED=ROOT/"dist"/"tier-audio89"
PREVIOUS={"Acrocephalus paludicola","Calidris ferruginea","Calidris pugnax",
          "Charadrius dubius","Emberiza pusilla","Eudromias morinellus",
          "Gavia arctica","Gyps fulvus","Larus cachinnans",
          "Lymnocryptes minimus","Melanitta nigra","Motacilla citreola"}
BAD_NOTES=re.compile(r"human speech|conversation|interview|voiceover|playback|recording of a person|together with a greenshank|grünschenkel|mit einem grünschenkel|other species|background bird|weitere vogelarten",re.I)
KNOWN_MIXED={"TSA:Aythya_nyroca_Lue_65_2_1"}
MAX_BYTES=13_000_000
TIME_LIMIT=430


def get(url, limit=180000, binary=False):
    req=Request(url,headers={"User-Agent":UA,"Accept":"audio/mpeg,*/*" if binary else "text/html"})
    with urlopen(req,timeout=25) as response:
        final=urlparse(response.geturl())
        if final.scheme!="https" or final.hostname!="suche.tierstimmenarchiv.de":
            raise ValueError("Archive request redirected outside Tierstimmenarchiv")
        if binary:
            if not (response.headers.get("Content-Type") or "").startswith(("audio/","application/octet-stream")):
                raise ValueError("Audio response not MP3")
            total=0
            data=bytearray()
            while True:
                chunk=response.read(131072)
                if not chunk:
                    break
                total+=len(chunk)
                if total>MAX_BYTES:
                    raise ValueError("Archive audio file too large")
                data.extend(chunk)
            return bytes(data)
        return response.read(limit).decode("utf-8","replace")


def search_ids(latin):
    ids=[]
    for page in (1,2):
        url=ORIGIN+"/search/query.html?"+urlencode({
             "species":latin,"page":page,
             "requested":"species,duration,description,sound_type,usage_permission"
        })
        try:
            text=get(url,limit=240000)
        except (OSError,ValueError) as exc:
            print("TSA SEARCH ERROR",latin,type(exc).__name__,flush=True)
            break
        if latin.casefold() not in text.casefold():
            break
        found=re.findall(r"TSA:[A-Za-z0-9_-]+",unescape(text))
        for rid in found:
            if rid not in ids:
                ids.append(rid)
        if len(found)<10 or len(ids)>=20:
            break
        time.sleep(.3)
    return ids[:20]


def plaintext(text):
    text=re.sub(r"(?is)<script\b[^>]*>.*?</script>"," ",text)
    text=re.sub(r"(?is)<style\b[^>]*>.*?</style>"," ",text)
    return re.sub(r"\s+"," ",unescape(re.sub(r"<[^>]+>"," ",text))).strip()


def parse_detail(latin, identifier, html):
    if not re.fullmatch(r"TSA:[A-Za-z0-9_-]+",identifier):
        return None
    if identifier in KNOWN_MIXED:
        return None
    if latin.casefold() not in plaintext(html).casefold():
        return None
    # Licensing must be extracted from this individual recording, NOT site footer.
    license_section=re.search(r"(?is)<div[^>]+class=['\"][^'\"]*\blicense\b[^'\"]*['\"][^>]*>(.{0,2100})",html)
    if not license_section:
        return None
    section=license_section.group(1)
    match=re.search(r"https://creativecommons\.org/licenses/(by|by-sa)/(\d+\.\d+)/(?:[a-z-]+/)?legalcode",section,re.I)
    if not match or re.search(r"CC BY-NC|CC BY-ND|CC BY-NC-SA",plaintext(section[:500]),re.I):
        return None
    license_url="https://creativecommons.org/licenses/"+match.group(1).lower()+"/"+match.group(2)+"/"
    if not accepted_license(license_url):
        return None
    audio=re.search(r"(?is)<audio\b[^>]*\bsrc=['\"]([^'\"]+)['\"]",html)
    if not audio:
        return None
    link=urljoin(ORIGIN,unescape(audio.group(1)))
    parsed=urlparse(link)
    if parsed.scheme!="https" or parsed.hostname!="suche.tierstimmenarchiv.de" or parsed.path!="/download.mp3":
        return None
    if parse_qs(parsed.query).get("unique_identifier")!=[identifier]:
        return None
    text=plaintext(html)
    m=re.search(r"\bAuthor\s+(.{2,170}?)\s+Collection\b",text,re.I)
    author=m.group(1).strip() if m else ""
    author=re.sub(r"\s+"," ",author)
    if not author or len(author)>120 or author.casefold() in ("unknown","unbekannt","-", "none"):
        return None
    brief=re.search(r"\bDescription\s+(.{0,450}?)\s+(?:Sound\s+type|Sound\s+quality|Location|Author|Collection|Recording|Date)\b",text,re.I)
    note=brief.group(1).strip() if brief else ""
    if BAD_NOTES.search(note):
        return None
    source=ORIGIN+"/search/showdetails.html?"+urlencode({"unique_identifier":identifier,"language":"deutsch"})
    return {"recordingId":identifier,"sourcePlatform":"Tierstimmenarchiv",
            "sourceTaxon":latin,"source":source,"url":link,
            "author":author,"license":license_url,
            "quality":"Tierstimmenarchiv; FFmpeg QA",
            "type":"Archived animal voice: species unverified by independent listening",
            "description":note[:300]}


def discover(latin, deadline):
    ids=search_ids(latin)
    accepted=[]
    for ident in ids:
        if time.monotonic()>deadline:
            break
        url=ORIGIN+"/search/showdetails.html?"+urlencode({"unique_identifier":ident,"language":"deutsch"})
        try:
            source=get(url)
            item=parse_detail(latin,ident,source)
            if item:
                accepted.append(item)
        except (OSError,ValueError) as exc:
            print("TSA DETAILS",latin,ident,type(exc).__name__,flush=True)
        if len(accepted)>=7:
            break
        time.sleep(.18)
    return accepted


def main(apply=False):
    deadline=time.monotonic()+TIME_LIMIT
    if apply:
        birds=read_catalog()
        by_latin={x["latin"]:x for x in birds}
        baseline=json.loads((ROOT/"data"/"voice-baseline85.json").read_text(encoding="utf-8"))["records"]
        if len(baseline)!=265:
            raise ValueError("Missing historical audio baseline")
        for entry in baseline:
            if filehash(APP/entry["file"])!=entry["sha256"]:
                raise ValueError("Baseline audio hash mismatch: "+entry["latin"])
        hashes={filehash(APP[b["audioFile"]]) for b in birds if b.get("audioFile")}
        pending=[(x["latin"],x["name"]) for x in birds if not x.get("audioFile")]
    else:
        baseline=[]
        by_latin={}
        hashes=set()
        pending=[(latin,name) for latin,name in catalog_missing() if latin not in PREVIOUS]
    results=[]
    not_found=[]
    for i,(latin,name) in enumerate(pending,1):
        if time.monotonic()>deadline:
            not_found.append({"latin":latin,"reason":"Archive search exceeded bounded time limit"})
            continue
        matched=None
        for item in discover(latin,deadline)[:7]:
            name_tag=re.sub(r"[^a-z0-9_-]","-",item["recordingId"].lower())
            STAGED.mkdir(parents=True,exist_ok=True)
            path=STAGED/(latin.lower().replace(" ","-")+"-"+name_tag+".mp3")
            try:
                with tempfile.TemporaryDirectory() as tmp:
                    raw=Path(tmp)/"source.mp3"
                    raw.write_bytes(get(item["url"],binary=True))
                    if len(raw.read_bytes())<3000:
                        raise ValueError("Empty MP3 audio file")
                    transcode(raw,path,ffmpeg_path())
                quality=verify_audio(path)
                digest=filehash(path)
                if digest in hashes:
                    raise ValueError("Cross-species duplicate MP3")
                if apply:
                    receipt=promote(by_latin[latin],item,path,hashes,quality)
                    by_latin[latin]["audioCredits"]["audioProcessing"]="Tierstimmenarchiv MP3 converted to 32kHz mono MP3, up to 45 seconds"
                    by_latin[latin]["audioCredits"]["speciesMatch"]="Archive taxon metadata matches Latin name; not independently verified by listening"
                    matched=receipt
                else:
                    hashes.add(digest)
                    matched={"latin":latin,"name":name,"source":item["source"],
                             "recordingId":item["recordingId"],"author":item["author"],
                             "license":item["license"],"sha256":digest,
                             "bytes":path.stat().st_size,"metrics":quality}
                break
            except (OSError,ValueError,subprocess.TimeoutExpired) as exc:
                print("TSA REJECT",latin,item["recordingId"],str(exc)[:115],flush=True)
            except Exception as exc:
                print("TSA DOWNLOAD ISSUE",latin,item["recordingId"],type(exc).__name__,flush=True)
        if matched:
            results.append(matched)
        else:
            not_found.append({"latin":latin,"reason":"No exact-taxonomy CC BY/SA MP3 passed technical checks"})
        print(f"TSA {i:02d}/{len(pending)} {latin}: "+("added" if matched else "missing"),flush=True)
    OUT.mkdir(parents=True,exist_ok=True)
    report={"target":298,"baselinePreserved":265,"speciesSearched":len(pending),
            "newVoices":len(results),"manualHumanVerified":0,"records":results,
            "notFound":not_found,
            "note":"Species assignment based on archive metadata only; no independent listening"}
    reportfile=OUT/("tsa-import89.json" if apply else "tsa-discovery89.json")
    reportfile.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    if apply:
        for entry in baseline:
            if filehash(APP/entry["file"])!=entry["sha256"]:
                raise ValueError("Original voice modified")
        CAT.write_text("window.BIRDS_DATA="+json.dumps(birds,ensure_ascii=False,separators=(",",":"))+";",encoding="utf-8")
        data=json.loads(COVERAGE.read_text(encoding="utf-8"))
        count=sum(bool(b.get("audioFile")) for b in birds)
        data["birdCalls"]=count
        data["missingAudio"]=[b["latin"] for b in birds if not b.get("audioFile")]
        data["audioTechnicalAccepted"]=count
        data["audioTechnicalRejected"]=0
        data["tsa89"]={"newVoices":len(results),"manualReviewed":0,"remaining":298-count}
        for key in ("milestone150","milestone200","milestone250","milestone298"):
            if isinstance(data.get(key),dict):
                goal=int(data[key].get("target") or key.replace("milestone",""))
                data[key].update(verifiedAudioSpecies=count,shortfall=max(0,goal-count),achieved=count>=goal)
        COVERAGE.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding="utf-8")
        print("TSA AUTOFILL",json.dumps({"added":len(results),"allVoices":count,
               "remaining":298-count,"old265Verified":True},ensure_ascii=False),flush=True)
    else:
        print("TSA DISCOVERY",json.dumps({"found":len(results),"notFound":len(not_found)},ensure_ascii=False),flush=True)
    return report


if __name__=="__main__":
    ap=argparse.ArgumentParser()
    ap.add_argument("--apply",action="store_true")
    args=ap.parse_args()
    main(args.apply)
