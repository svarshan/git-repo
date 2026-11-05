#!/usr/bin/env python3
"""MoOLVa 8.7: final exact-taxon sound search for Pallas's gull.

No playback synthesis, no borrowing another gull's voice and no assertion that a
metadata-matched field recording has been identified by a human. If sources
remain unavailable or fail open-license/technical QA, preserve 297/298 honestly.
"""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time

from attach_voices88 import read_catalog, filehash, promote, soft_xeno
from stage_xeno87 import check_recording, download_source, ffmpeg_path, transcode, verify_audio
from xeno_candidates87 import query_page

ROOT=Path(__file__).resolve().parents[1]
APP=ROOT/'app'
REPORT=ROOT/'dist'/'release-evidence'/'final-voice94.json'
TARGET='Ichthyaetus ichthyaetus'
ALIASES=(TARGET,'Larus ichthyaetus')
LIMIT=9

def candidate(rec,taxon):
    """Accept only exact current/older scientific binomial, not gull-family audio."""
    if taxon not in ALIASES:
        return None
    item=check_recording(rec,taxon) or soft_xeno(rec,taxon)
    if not item:
        return None
    if str(item.get('quality')) not in ('A','B','C'):
        return None
    if not str(item.get('license','')).startswith('https://creativecommons.org/'):
        return None
    if not str(item.get('recordingId','')).startswith('XC'):
        return None
    return item

def discover():
    found={}
    errors=[]
    for taxon in ALIASES:
        for page in (1,2,3):
            try:
                data=query_page(taxon,page)
            except (RuntimeError,ValueError,KeyError) as exc:
                errors.append(taxon+' page '+str(page)+': '+str(exc)[:130])
                break
            for rec in data.get('recordings',[]):
                value=candidate(rec,taxon)
                if value:
                    found.setdefault(value['id'],value)
            pages=int(data.get('numPages') or 1)
            if page>=pages:
                break
            time.sleep(.3)
    ranked=sorted(found.values(),key=lambda v:('ABC'.index(v['quality']),0 if 'call' in v['type'].lower() else 1,int(v['id'])))
    return ranked[:LIMIT],errors

def finish(report):
    REPORT.parent.mkdir(parents=True,exist_ok=True)
    REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print('FINAL VOICE 94',json.dumps({k:report[k] for k in ('state','before','after','source','candidateCount')},ensure_ascii=False),flush=True)
    return report

def run():
    birds=read_catalog()
    bird=next(x for x in birds if x['latin']==TARGET)
    before=sum(bool(b.get('audioFile')) for b in birds)
    report={'species':TARGET,'before':before,'after':before,'source':None,
            'candidateCount':0,'errors':[],'humanReviewed':False,
            'speciesHumanVerified':False,'note':'File count is not ornithological species verification.'}
    if bird.get('audioFile'):
        report['state']='already-present'
        return finish(report)
    if not os.getenv('XENO_CANTO_API_KEY','').strip():
        report.update(state='no-api-key')
        return finish(report)
    candidates,errors=discover()
    report['candidateCount']=len(candidates);report['errors'].extend(errors)
    hashes={filehash(APP/b['audioFile']) for b in birds if b.get('audioFile')}
    for item in candidates:
        try:
            with tempfile.TemporaryDirectory() as tmp:
                original=Path(tmp)/'source.bin'
                converted=Path(tmp)/'clean.mp3'
                download_source(item['url'],original)
                transcode(original,converted,ffmpeg_path())
                metrics=verify_audio(converted)
                metrics['sourceTaxon']=item['sourceTaxon']
                digest=hashlib.sha256(converted.read_bytes()).hexdigest()
                if digest in hashes:raise ValueError('identical audio already belongs to another catalog species')
                promoted=promote(bird,{**item,'sourcePlatform':'Xeno-canto'},converted,hashes,metrics)
            if bird.get('audioFile') and promoted['recordingId'].startswith('XC'):
                bird['audioCredits']['speciesMatch']='exact Xeno-canto scientific name or documented Larus ichthyaetus synonym; not verified by ear'
                bird['audioCredits']['audioProcessing']='FFmpeg: at most 45 sec, 32 kHz mono MP3'
                (APP/'data.js').write_text('window.BIRDS_DATA='+json.dumps(birds,ensure_ascii=False,separators=(',',':'))+';',encoding='utf8')
                report.update(state='candidate-installed-unreviewed',source=promoted['source'],
                              recordingId=promoted['recordingId'],after=before+1,sha256=digest)
                return finish(report)
        except (OSError,ValueError,subprocess.TimeoutExpired) as exc:
            report['errors'].append(item['recordingId']+': '+str(exc)[:190])
        except Exception as exc:
            report['errors'].append(item['recordingId']+': '+type(exc).__name__)
    report['state']='no-eligible-recording'
    return finish(report)

if __name__=='__main__':run()
