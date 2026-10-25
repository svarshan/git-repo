#!/usr/bin/env python3
"""MoOLVa 7.4 Voices and Bird AI PRO — acquire real, individually licensed sound
recordings from iNaturalist observation sounds (not unrelated observations).

Next milestone: 200 of the 298 catalog species. Never synthesize missing calls.
Only exact accepted scientific binomials, research-grade observations and media-
level CC0/CC BY/CC BY-SA licenses are admissible. Audio QA via real FFmpeg.
An automated metadata and signal check is NOT expert bird identification.
"""
from pathlib import Path
from urllib.parse import urlparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
import time

import requests
import imageio_ffmpeg
from make_catalog import APP, ROOT, M, valid_existing_media
from harvest_voices import SYNONYMS
from audit_audio import inspect

CAT = APP / 'data.js'
REPORT = ROOT / 'data' / 'coverage.json'
TARGET = 200
HOST = 'https://api.inaturalist.org/v1/observations'
HEADERS = {'User-Agent': 'MoOLVaBirdAtlas/7.3 (small bounded CC-licensed research; github.com/svarshan/git-repo)'}
ALLOWED = {
    'cc0': 'https://creativecommons.org/publicdomain/zero/1.0/',
    'cc-by': 'https://creativecommons.org/licenses/by/4.0/',
    'cc-by-sa': 'https://creativecommons.org/licenses/by-sa/4.0/',
}
MAX_BYTES = 12_000_000
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()


def allowed_host(host):
    host = str(host or '').lower()
    return (host.endswith('.inaturalist.org') or host == 'inaturalist.org'
            or host == 'inaturalist-open-data.s3.amazonaws.com')


def canonical(name):
    return re.sub(r'\s+', ' ', str(name or '')).strip().casefold()


def same_species(species, bird):
    supported = [bird.get('latin', '')] + SYNONYMS.get(bird.get('latin', ''), [])
    return canonical(species) in {canonical(n) for n in supported}


def inspect_sound(sound, observation, bird):
    if not isinstance(sound, dict) or not isinstance(observation, dict):
        return None
    tx = observation.get('taxon') or {}
    if not same_species(tx.get('name'), bird):
        return None
    # Important: the OBSERVATION license is not the media license.
    license_code = str(sound.get('license_code') or '').lower().strip()
    if license_code not in ALLOWED:
        return None
    url = str(sound.get('file_url') or '').strip()
    parsed = urlparse(url)
    if parsed.scheme != 'https' or not allowed_host(parsed.hostname):
        return None
    if not isinstance(observation.get('id'), int) or not isinstance(sound.get('id'), int):
        return None
    ext = Path(parsed.path).suffix.lower()
    mime = str(sound.get('file_content_type') or '').lower()
    if ext in ('.m4a', '.mp4', '.aac', '.mp3', '.wav', '.ogg', '.oga'):
        pass
    elif mime not in ('audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/wav', 'audio/ogg'):
        return None
    author = str(sound.get('attribution') or
                 (observation.get('user') or {}).get('name') or
                 (observation.get('user') or {}).get('login') or '').strip()
    if not author:
        return None
    return dict(
        source='https://www.inaturalist.org/observations/' + str(observation['id']),
        soundId=sound['id'],
        recordingId='iNat:' + str(sound['id']),
        url=url,
        author=author[:250],
        license=license_code.upper(),
        licenseUrl=ALLOWED[license_code],
        speciesMatch='exact scientific taxon name on research-grade iNaturalist observation',
        audioReview='exact research-grade taxon and individual sound license checked; sound not manually identified',
        vocalization='Запись с наблюдения; тип сигнала не проверен',
        sourcePlatform='iNaturalist',
    )


def query(bird, session, deadline):
    names = list(dict.fromkeys([bird.get('latin', '')] + SYNONYMS.get(bird.get('latin', ''), [])))
    seen = set()
    for latin in names[:2]:
        if time.monotonic() >= deadline:
            break
        try:
            resp = session.get(HOST, params={
                'taxon_name': latin, 'sounds': 'true',
                'sound_license': 'cc0,cc-by,cc-by-sa',
                'quality_grade': 'research', 'per_page': 15, 'order_by': 'created_at',
                'order': 'desc'
            }, timeout=(7, 17), headers=HEADERS)
            if resp.status_code in (403, 429):
                print('iNaturalist throttled HTTP', resp.status_code, flush=True)
                return []
            resp.raise_for_status()
            payload = resp.json()
        except (requests.RequestException, ValueError) as e:
            print('iNat query unavailable', bird.get('latin'), str(e)[:100], flush=True)
            continue
        for obs in (payload.get('results') or [])[:15]:
            if str(obs.get('quality_grade') or '').lower() != 'research':
                continue
            if obs.get('captive') is True:
                continue
            for sound in (obs.get('sounds') or [])[:5]:
                found = inspect_sound(sound, obs, bird)
                if found and found['recordingId'] not in seen:
                    seen.add(found['recordingId'])
                    yield found


def download(candidate, dest, session, deadline):
    if time.monotonic() >= deadline:
        return False
    try:
        with session.get(candidate['url'], stream=True, timeout=(8, 30), headers=HEADERS) as resp:
            resp.raise_for_status()
            if not allowed_host(urlparse(resp.url).hostname):
                return False
            if int(resp.headers.get('Content-Length') or 0) > MAX_BYTES:
                return False
            total=0
            with dest.open('wb') as out:
                for chunk in resp.iter_content(65536):
                    if time.monotonic() >= deadline: raise RuntimeError('voice budget exhausted')
                    total += len(chunk)
                    if total > MAX_BYTES: raise RuntimeError('file larger than allowed')
                    out.write(chunk)
            return total >= 3000
    except (OSError, RuntimeError, ValueError, requests.RequestException) as e:
        print('iNat audio download rejected', str(e)[:100], flush=True)
        return False


def transcode(raw, out):
    # Original remains subject to its license, and processed audio credit records the transformation.
    cmd=[FFMPEG,'-nostdin','-hide_banner','-loglevel','error','-y','-i',str(raw),
         '-t','40','-vn','-ac','1','-ar','32000',
         '-af','highpass=f=130,lowpass=f=12000,alimiter=limit=0.96',
         '-codec:a','libmp3lame','-qscale:a','4',str(out)]
    run=subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=60)
    if run.returncode or not out.is_file() or out.stat().st_size<3000:
        raise ValueError('FFmpeg unable to produce bird sound')
    return inspect(out)


def filehash(path):
    h=hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda:stream.read(131072),b''):
            h.update(chunk)
    return h.hexdigest()


def checkpoint(birds, started, queries, acquired, rejected):
    CAT.write_text('window.BIRDS_DATA='+json.dumps(birds,ensure_ascii=False,separators=(',',':'))+';',encoding='utf8')
    report=json.loads(REPORT.read_text('utf8'))
    count=sum(bool(b.get('audioFile') and valid_existing_media(b,'audioFile')) for b in birds)
    report['birdCalls']=count
    report['missingAudio']=[b['latin'] for b in birds if not valid_existing_media(b,'audioFile')]
    report['milestone200']={
        'target': TARGET, 'baseline': started, 'verifiedAudioSpecies': count,
        'achieved': count>=TARGET,
        'addedFromINaturalist': acquired, 'iNaturalistSpeciesQueries': queries,
        'candidatesRejected': rejected,
        'shortfall': max(0,TARGET-count),
        'note': 'Audio file metadata and signal validated; no expert listening certification.'
    }
    REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
    print('VOICES 200 PROGRESS',json.dumps(report['milestone200'],ensure_ascii=False),flush=True)
    return count


def main():
    raw=CAT.read_text('utf8').strip()
    if not raw.startswith('window.BIRDS_DATA='):
        raise RuntimeError('Missing prior validated offline bird catalog')
    birds=json.loads(raw[len('window.BIRDS_DATA='):].rstrip(';'))
    if len(birds)!=298:raise RuntimeError('Unexpected bird catalog size')
    started=sum(bool(valid_existing_media(b,'audioFile')) for b in birds)
    remaining=[i for i,b in enumerate(birds) if not valid_existing_media(b,'audioFile')]
    print('VOICES 200 BASELINE',started,'missing',len(remaining),flush=True)
    budget=max(60,min(1800,int(os.environ.get('BIRDS_VOICES_200_BUDGET_SECONDS','900'))))
    deadline=time.monotonic()+budget
    queries=acquired=rejected=0
    originals={filehash(APP/b['audioFile']) for b in birds if valid_existing_media(b,'audioFile')}
    session=requests.Session()
    for idx in remaining:
        if time.monotonic()>=deadline or started+acquired>=TARGET:break
        bird=birds[idx]
        # ~45 requests/minute: below the published <=60/min recommendation.
        if queries:time.sleep(1.15)
        queries+=1
        for candidate in query(bird,session,deadline):
            if time.monotonic()>=deadline:break
            target=M/'audio'/(bird['id']+'-inat.mp3')
            M.joinpath('audio').mkdir(parents=True, exist_ok=True)
            try:
                with tempfile.TemporaryDirectory() as folder:
                    rawfile=Path(folder)/'source.audio'
                    out=Path(folder)/'processed.mp3'
                    if not download(candidate,rawfile,session,deadline):
                        rejected+=1;continue
                    quality=transcode(rawfile,out)
                    digest=filehash(out)
                    if digest in originals:
                        rejected+=1;continue
                    # No existing licensed audio is replaced; only a missing species gets a new file.
                    shutil.copy2(out,target)
                    originals.add(digest)
                    credit={k:v for k,v in candidate.items() if k!='url'}
                    credit['audioQuality']=quality
                    credit['audioProcessing']='FFmpeg low/high pass, limiter, 32 kHz mono MP3'
                    bird['audioFile']='media/audio/'+target.name
                    bird['audioCredits']=credit
                    acquired+=1
                    break
            except (OSError, ValueError, subprocess.TimeoutExpired, RuntimeError) as e:
                rejected+=1
                print('VOICES 200 QA FAIL',bird.get('latin'),str(e)[:140],flush=True)
                target.unlink(missing_ok=True)
        if queries%10==0 or acquired:
            checkpoint(birds,started,queries,acquired,rejected)
    final=checkpoint(birds,started,queries,acquired,rejected)
    print('VOICES 200 FINAL',final,'/',TARGET,
          'GOAL MET' if final>=TARGET else 'GOAL NOT MET — keep existing verified sounds',flush=True)

if __name__=='__main__':main()
