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


# Wikimedia Commons file was checked against its original attribution page:
# https://commons.wikimedia.org/wiki/File:Larus_ichthyaetus_720p.webm
# Video: colony calls of Pallas's Gull adults and chicks, Manych, Kalmykia,
# Dmitry Mikhirev, 23 May 2010, Creative Commons BY-SA 4.0.
# A derived audio segment must preserve the author's credit, licence and modification notice.
COMMONS_PAGE='https://commons.wikimedia.org/wiki/File:Larus_ichthyaetus_720p.webm'
COMMONS_MEDIA='https://upload.wikimedia.org/wikipedia/commons/4/48/Larus_ichthyaetus_720p.webm'
COMMONS_LICENSE='https://creativecommons.org/licenses/by-sa/4.0/'
COMMONS_AUTHOR='Dmitry Mikhirev'

def commons_video_fallback(bird,hashes):
    from urllib.parse import urlparse
    from urllib.request import Request,urlopen
    from repair_clanga93 import signal_contrast
    with tempfile.TemporaryDirectory() as folder:
        src=Path(folder)/'commons-pallas-gull.webm'
        dst=Path(folder)/'commons-call.mp3'
        req=Request(COMMONS_MEDIA,headers={'User-Agent':'MoOLVaBirdAtlas/8.7 (CC BY-SA bird recording; github.com/svarshan/git-repo)'})
        with urlopen(req,timeout=55) as response:
            uri=urlparse(response.geturl())
            if uri.scheme!='https' or uri.hostname!='upload.wikimedia.org':
                raise ValueError('Wikimedia media redirected outside trusted Wikimedia upload domain')
            if int(response.headers.get('Content-Length') or 0)>25_000_000:
                raise ValueError('Wikimedia video too large')
            total=0
            with src.open('wb') as output:
                while True:
                    part=response.read(131072)
                    if not part:break
                    total+=len(part)
                    if total>25_000_000:raise ValueError('Wikimedia video exceeds maximum allowed download size')
                    output.write(part)
        if src.stat().st_size<200000:raise ValueError('Wikimedia video not downloaded correctly')
        command=[ffmpeg_path(),'-nostdin','-hide_banner','-loglevel','error','-y',
                 '-i',str(src),'-t','45','-vn','-ac','1','-ar','32000',
                 '-af','highpass=f=250,lowpass=f=6500','-c:a','libmp3lame','-q:a','4',str(dst)]
        result=subprocess.run(command,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,timeout=110)
        if result.returncode or not dst.is_file() or dst.stat().st_size<3000:
            raise ValueError('Could not extract licensed bird-call audio from Wikimedia video')
        metrics=verify_audio(dst)
        # A rise over the ambient background is evidence of distinct calls,
        # not independent verification of the species or absence of human speech.
        contrast=signal_contrast(dst)
        metrics['signalContrastDb']=contrast
        digest=hashlib.sha256(dst.read_bytes()).hexdigest()
        if digest in hashes:raise ValueError('Commons audio would duplicate another species')
        recording_id='WM'+digest[:12]
        item={'recordingId':recording_id,'source':COMMONS_PAGE,
              'sourceTaxon':'Larus ichthyaetus','license':COMMONS_LICENSE,
              'author':COMMONS_AUTHOR,'sourcePlatform':'Wikimedia Commons',
              'type':'Calls of adults and nestlings (colony)',
              'quality':'source video: CC BY-SA 4.0, audio extracted'}
        imported=promote(bird,item,dst,hashes,metrics)
    bird['audioCredits'].update({
        'license':'CC BY-SA 4.0','licenseUrl':COMMONS_LICENSE,
        'audioProcessing':'Wikimedia Commons WebM video audio extracted to mono MP3; highpass 250 Hz, lowpass 6500 Hz, first 45 s; derivative remains CC BY-SA 4.0.',
        'licenseNotice':'© Dmitry Mikhirev, original Larus ichthyaetus 720p.webm (Wikimedia Commons), CC BY-SA 4.0. Audio was extracted, clipped and filtered.',
        'speciesMatch':'Commons original video names Larus ichthyaetus and describes adult and nestling calls; not checked by ear',
        'reviewStatus':'awaiting-user-review',
        'speciesHumanVerified':False
    })
    return imported

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
    # Strictly curated open-licensed recording from the actual species in a Commons video.
    # If network/audio QA fails, remain silent rather than fabricating the 298th call.
    try:
        imported=commons_video_fallback(bird,hashes)
        (APP/'data.js').write_text('window.BIRDS_DATA='+json.dumps(birds,ensure_ascii=False,separators=(',',':'))+';',encoding='utf8')
        report.update(state='commons-colony-calls-unreviewed',source=COMMONS_PAGE,
                      recordingId=imported['recordingId'],after=before+1,
                      license=COMMONS_LICENSE,author=COMMONS_AUTHOR,
                      audioSource='video colony calls, adult and juvenile, not independently listened to')
        return finish(report)
    except (OSError,ValueError,subprocess.TimeoutExpired) as exc:
        report['errors'].append('Wikimedia Commons video: '+str(exc)[:190])
    except Exception as exc:
        report['errors'].append('Wikimedia Commons video: '+type(exc).__name__)
    report['state']='no-eligible-recording'
    return finish(report)

if __name__=='__main__':run()
