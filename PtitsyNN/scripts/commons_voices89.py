#!/usr/bin/env python3
"""Find open-license real bird recordings on Wikimedia Commons and fill missing calls.

Strict taxon/title match or manually investigated Commons filenames; media-specific
CC0 / CC BY / CC BY-SA license from Commons imageinfo, author attribution,
HTTPS upload host, audio-only file, FFmpeg loudness QA and no duplicate hashes.

New voices are labelled awaiting-user-review. This does NOT replace any of the
historical 265 sound files, or claim expert identification of recordings.
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
from urllib.parse import quote, urlencode, urlparse
from urllib.request import Request, urlopen

from attach_voices88 import (
    APP, ROOT, CAT, COVERAGE, OUT, read_catalog, filehash, promote,
)
from stage_xeno87 import ffmpeg_path, transcode, verify_audio
from xeno_candidates87 import accepted_license, catalog_missing

ENDPOINT="https://commons.wikimedia.org/w/api.php"
UA="MoOLVaBirdAtlas/8.6 (audio attribution verification; github.com/svarshan/git-repo)"
STAGING=ROOT/"dist"/"commons-audio89"
PREVIOUS={"Acrocephalus paludicola","Calidris ferruginea","Calidris pugnax",
          "Charadrius dubius","Emberiza pusilla","Eudromias morinellus",
          "Gavia arctica","Gyps fulvus","Larus cachinnans",
          "Lymnocryptes minimus","Melanitta nigra","Motacilla citreola"}
# Specific audio items identified from publicly listed Commons audio categories.
# Names of German-language pronunciation clips are intentionally excluded.
KNOWN={
 "Anser anser":[
   "File:Anser anser - Greylag Goose XC436358.mp3",
   "File:Anser anser - Greylag Goose XC518305.mp3",
   "File:Greylag Goose (Anser anser) - Bærum, Norway 2021-04-03.mp3",
   "File:Oca Vulgar.ogg"],
 "Ciconia nigra":["File:Black stork.ogg"],
 "Surnia ulula":["File:Northern hawk owl.ogg"],
}
# The named Commons film explicitly describes calls of Pallas's gull adults and nestlings.
# Only its original audio track may be extracted; arbitrary bird videos are not accepted.
KNOWN_VIDEO={"Ichthyaetus ichthyaetus":["File:Larus ichthyaetus 720p.webm"]}
RED_FLAGS=re.compile(r"pronunciat|aussprach|prononcia|word spoken|spoken word|speaker:|speech|voiceover|voice-over|interview|narrat|human voice|dictionary|wiktionary",re.I)
MEDIA_ALLOWED=re.compile(r"\.(?:mp3|ogg|oga|flac|wav|opus)$",re.I)
ALLOWED_UPLOAD="upload.wikimedia.org"
SEARCH_LIMIT=12
TIME_BUDGET=260


def api(params):
    from urllib.error import HTTPError
    q=dict(params)
    q.update(action=q.get("action","query"),format="json",formatversion="2")
    req=Request(ENDPOINT+"?"+urlencode(q),headers={"User-Agent":UA,"Accept":"application/json"})
    for attempt in range(5):
        try:
            with urlopen(req,timeout=32) as response:
                if urlparse(response.geturl()).hostname!="commons.wikimedia.org":
                    raise ValueError("Commons API redirected to another site")
                out=json.load(response)
            if not isinstance(out,dict) or "error" in out:
                raise ValueError("Unexpected Commons API response")
            time.sleep(1.1)  # Be considerate of Wikimedia's rate limits
            return out
        except HTTPError as exc:
            if exc.code not in (429,500,502,503,504) or attempt==4:
                raise
            print("COMMONS RETRY",exc.code,"attempt",attempt+1,flush=True)
            time.sleep(min(18,2*(2**attempt)))
    raise RuntimeError("Commons API query attempts exhausted")


def search_titles(latin):
    try:
        payload=api({"list":"search","srnamespace":6,"srsearch":'"'+latin+'" filetype:audio',"srlimit":SEARCH_LIMIT})
        rows=payload.get("query",{}).get("search",[])
    except Exception as exc:
        print("COMMONS SEARCH",latin,type(exc).__name__,flush=True)
        return []
    output=[]
    for row in rows:
        title=str(row.get("title") or "")
        if title.startswith("File:") and MEDIA_ALLOWED.search(title) and \
           latin.casefold() in title.replace("_"," ").casefold() and not RED_FLAGS.search(title):
            output.append(title)
    return output[:6]


def plain(html):
    s=re.sub(r"<[^>]*>"," ",str(html or ""))
    return re.sub(r"\s+"," ",unescape(s)).strip()


def parse_info(latin, title, ii):
    if not isinstance(ii,dict):
        return None
    title=str(title)
    video_audio=title in KNOWN_VIDEO.get(latin,[])
    if not title.startswith("File:") or not (MEDIA_ALLOWED.search(title) or video_audio):
        return None
    if not video_audio and title not in KNOWN.get(latin,[]) and latin.casefold() not in title.replace("_"," ").casefold():
        return None
    if RED_FLAGS.search(title):
        return None
    url=str(ii.get("url") or "")
    u=urlparse(url)
    if u.scheme!="https" or u.hostname!=ALLOWED_UPLOAD or not u.path.startswith("/wikipedia/commons/"):
        return None
    meta=ii.get("extmetadata") or {}
    lic=accepted_license((meta.get("LicenseUrl") or {}).get("value",""))
    artist=plain((meta.get("Artist") or {}).get("value",""))
    description=plain((meta.get("ImageDescription") or {}).get("value",""))
    if not lic or not artist or len(artist)>220 or RED_FLAGS.search(description[:1500]):
        return None
    # Some old files have no description, but a definite category/bird filename.
    mimetype=str(ii.get("mime") or "")
    if video_audio:
        if mimetype!="video/webm" or str(ii.get("mediatype") or "").upper()!="VIDEO":
            return None
        if not re.search(r"\bcalls?\b|\bкрик[иаое]\b",description,re.I):
            return None
    else:
        if not mimetype.startswith("audio/") and mimetype not in ("application/ogg","application/x-ogg"):
            return None
        if str(ii.get("mediatype") or "AUDIO").upper()!="AUDIO":
            return None
    limit=23_000_000 if video_audio else 13_000_000
    if int(ii.get("size") or 0)<3000 or int(ii.get("size") or 0)>limit:
        return None
    source="https://commons.wikimedia.org/wiki/"+quote(title.replace(" ","_"),safe=":_()'-")
    return {
        "latin":latin,"title":title,"source":source,"url":url,
        "author":artist,"license":lic,"sourcePlatform":"Wikimedia Commons",
        "sourceTaxon":latin,"quality":"Commons field recording; technical QA only",
        "type":"Bird sound (unverified by independent listening)",
        "recordingId":"WM"+hashlib.sha1(title.encode("utf-8")).hexdigest()[:12],
        "description":description[:350],"videoAudio":video_audio,
    }


def retrieve_candidates(latin, deadline):
    titles=list(dict.fromkeys(KNOWN.get(latin,[])+KNOWN_VIDEO.get(latin,[])+search_titles(latin)))
    if not titles:
        return []
    entries=[]
    for i in range(0,len(titles),10):
        if time.monotonic()>deadline:
            break
        try:
            response=api({"prop":"imageinfo","iiprop":"url|extmetadata|mime|size|mediatype",
                          "titles":"|".join(titles[i:i+10]),"redirects":1})
        except Exception as exc:
            print("COMMONS METADATA ERROR",latin,type(exc).__name__,flush=True)
            continue
        for page in response.get("query",{}).get("pages",[]):
            info=(page.get("imageinfo") or [{}])[0]
            matched=parse_info(latin,page.get("title",""),info)
            if matched:
                entries.append(matched)
        time.sleep(.3)
    return sorted(entries,key=lambda e:(0 if "XC" in e["title"] else 1,len(e["title"])))[:8]


def download_wikimedia(url,target,max_bytes=13_000_000):
    req=Request(url,headers={"User-Agent":UA})
    total=0
    with urlopen(req,timeout=35) as response:
        final=urlparse(response.geturl())
        if final.scheme!="https" or final.hostname!=ALLOWED_UPLOAD or not final.path.startswith("/wikipedia/commons/"):
            raise ValueError("Commons audio redirected off Wikimedia")
        if int(response.headers.get("Content-Length") or 0)>max_bytes:
            raise ValueError("Commons audio too large")
        with target.open("wb") as stream:
            while True:
                block=response.read(131072)
                if not block:
                    break
                total+=len(block)
                if total>max_bytes:
                    raise ValueError("Commons file size exceeded")
                stream.write(block)
    if total<3500:
        raise ValueError("Commons recording too small")


def candidates_for(latin,deadline,existing_hashes):
    for item in retrieve_candidates(latin,deadline):
        if time.monotonic()>deadline:
            break
        fname=latin.lower().replace(" ","-")+"-"+item["recordingId"].lower()+".mp3"
        STAGING.mkdir(parents=True,exist_ok=True)
        preview=STAGING/fname
        try:
            with tempfile.TemporaryDirectory() as tmp:
                original=Path(tmp)/"source.bin"
                download_wikimedia(item["url"],original,max_bytes=23_000_000 if item.get("videoAudio") else 13_000_000)
                transcode(original,preview,ffmpeg_path())
            quality=verify_audio(preview)
            if filehash(preview) in existing_hashes:
                raise ValueError("Recording duplicates existing bird audio")
            item.update(filePath=preview,metrics=quality)
            yield item
        except (OSError,ValueError,subprocess.TimeoutExpired) as exc:
            print("COMMONS REJECT",latin,item["recordingId"],str(exc)[:120],flush=True)
        except Exception as exc:
            print("COMMONS DOWNLOAD ISSUE",latin,item["recordingId"],type(exc).__name__,flush=True)


def main(apply=False):
    deadline=time.monotonic()+TIME_BUDGET
    if apply:
        birds=read_catalog()
        by_latin={b["latin"]:b for b in birds}
        baseline=json.loads((ROOT/"data"/"voice-baseline85.json").read_text(encoding="utf-8"))
        originals=baseline["records"]
        if len(originals)!=265:
            raise ValueError("Original 265 audio inventory changed")
        for original in originals:
            if filehash(APP/original["file"])!=original["sha256"]:
                raise ValueError("Historical audio changed: "+original["latin"])
        hashes={filehash(APP/b["audioFile"]) for b in birds if b.get("audioFile")}
        pending=[(b["latin"],b["name"]) for b in birds if not b.get("audioFile")]
    else:
        by_latin={}
        hashes=set()
        pending=[(latin,name) for latin,name in catalog_missing() if latin not in PREVIOUS]
    imported=[]
    missing=[]
    for i,(latin,name) in enumerate(pending,1):
        if time.monotonic()>deadline:
            missing.append({"latin":latin,"reason":"Commons search time budget exhausted"})
            continue
        chosen=None
        for item in candidates_for(latin,deadline,hashes):
            try:
                if apply:
                    receipt=promote(by_latin[latin],item,item["filePath"],hashes,item["metrics"])
                    by_latin[latin]["audioCredits"]["audioProcessing"]="Wikimedia Commons "+("field video audio track" if item.get("videoAudio") else "audio source")+" transcoded to 32kHz mono MP3, up to 45 seconds"
                    by_latin[latin]["audioCredits"]["speciesMatch"]="Commons title/category indicates this bird; unverified by human"
                    chosen=receipt
                else:
                    hashes.add(filehash(item["filePath"]))
                    chosen={k:item[k] for k in ("latin","title","source","author","license","recordingId")}
                    chosen["sha256"]=filehash(item["filePath"])
                    chosen["metrics"]=item["metrics"]
                break
            except (ValueError,OSError) as exc:
                print("COMMONS IMPORT REJECT",latin,str(exc)[:120],flush=True)
        if chosen:
            imported.append(chosen)
        else:
            missing.append({"latin":latin,"reason":"no Commons recording passed taxon, license and technical checks"})
        print(f"COMMONS {i:02d}/{len(pending)} {latin}: "+("added" if chosen else "missing"),flush=True)
    report={"scanSpecies":len(pending),"newVoices":len(imported),"manualReviewedNew":0,
            "allSpecies":298,"baselineOriginal":265,
            "records":imported,"notFound":missing,
            "note":"Bird identities confirmed only from source metadata; user has not listened."}
    OUT.mkdir(parents=True,exist_ok=True)
    (OUT/("commons-import89.json" if apply else "commons-discovery89.json")).write_text(
        json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    if apply:
        for original in originals:
            if filehash(APP/original["file"])!=original["sha256"]:
                raise ValueError("Original 265 audio corruption")
        CAT.write_text("window.BIRDS_DATA="+json.dumps(birds,ensure_ascii=False,separators=(",",":"))+";",encoding="utf-8")
        coverage=json.loads(COVERAGE.read_text(encoding="utf-8"))
        count=sum(bool(b.get("audioFile")) for b in birds)
        coverage["birdCalls"]=count
        coverage["missingAudio"]=[b["latin"] for b in birds if not b.get("audioFile")]
        coverage["audioTechnicalAccepted"]=count
        coverage["audioTechnicalRejected"]=0
        coverage["commonsImport89"]={"newVoices":len(imported),"manualVerified":0,"remaining":298-count}
        for key in ("milestone150","milestone200","milestone250","milestone298"):
            if isinstance(coverage.get(key),dict):
                target=int(coverage[key].get("target") or key[9:])
                coverage[key].update(verifiedAudioSpecies=count,shortfall=max(0,target-count),achieved=count>=target)
        COVERAGE.write_text(json.dumps(coverage,ensure_ascii=False,indent=2),encoding="utf-8")
        print("COMMONS AUTOFILL",json.dumps({"new":len(imported),"total":count,
               "remaining":298-count,"original265Verified":True},ensure_ascii=False),flush=True)
    else:
        print("COMMONS DISCOVERY",json.dumps({"found":len(imported),"remaining":len(missing)},
                                             ensure_ascii=False),flush=True)
    return report


if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--apply",action="store_true")
    args=p.parse_args()
    main(args.apply)
