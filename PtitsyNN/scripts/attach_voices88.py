#!/usr/bin/env python3
"""Expand licensed bird audio sources and attach technically checked files to the
MoOLVa catalog without waiting for a human listening decision.

Never replace a historical recording. Record source, actual media license,
source taxon, technical measurements and USER REVIEW PENDING for every new voice.
Existing original 265 are protected by SHA-256 guard.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import time
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from stage_xeno87 import (
    APP, PREVIEWS, OUT, ALIAS, MAX_DOWNLOAD_BYTES, ffmpeg_path,
    check_recording, download_source, transcode, verify_audio,
)
from xeno_candidates87 import catalog_missing, accepted_license, query_page

ROOT = Path(__file__).resolve().parents[1]
CAT = APP / 'data.js'
COVERAGE = ROOT / 'data' / 'coverage.json'
ALLOWED_INAT = {'api.inaturalist.org', 'www.inaturalist.org',
                'inaturalist.org', 'inaturalist-open-data.s3.amazonaws.com'}
BLOCK = re.compile(r'(human speech|conversation|talking|interview|voice.?over|bird imitation|imitation|playback of|soundscape|music|mixed chorus)', re.I)
LICENSES = {'cc0':'https://creativecommons.org/publicdomain/zero/1.0/',
            'cc-by':'https://creativecommons.org/licenses/by/4.0/',
            'cc-by-sa':'https://creativecommons.org/licenses/by-sa/4.0/'}
LIMIT = 298
SRC_UA = 'MoOLVaBirdAtlas/8.6 (licensed field-recording audio acquisition; github.com/svarshan/git-repo)'


def read_catalog():
    s=CAT.read_text(encoding='utf-8-sig').strip()
    if not s.startswith('window.BIRDS_DATA='):
        raise ValueError('Invalid generated bird catalog')
    birds=json.loads(s[len('window.BIRDS_DATA='):].rstrip(';'))
    if len(birds)!=LIMIT or len({b['latin'] for b in birds})!=LIMIT:
        raise ValueError('Expected 298 distinct species')
    return birds


def filehash(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def soft_xeno(rec, taxon):
    """Allow non-English type labels, but never bypass species/license or explicit mix/speech flags."""
    if not isinstance(rec,dict) or len(taxon.split())!=2:
        return None
    a,b=taxon.casefold().split()
    if str(rec.get('gen') or '').casefold()!=a or str(rec.get('sp') or '').casefold()!=b:
        return None
    license_url=accepted_license(rec.get('lic'))
    rid=str(rec.get('id') or '')
    name=str(rec.get('rec') or '').strip()
    quality=str(rec.get('q') or '').upper()
    url=str(rec.get('file') or '').strip()
    t=str(rec.get('type') or '').strip()
    if not license_url or not rid.isdecimal() or not name or quality not in ('A','B','C') or not t:
        return None
    if BLOCK.search(str(rec.get('rmk') or '')+' '+t):
        return None
    also=rec.get('also')
    if (isinstance(also,list) and any(str(v).strip() for v in also)) or \
       (isinstance(also,str) and also.strip() not in ('','[]')):
        return None
    if str(rec.get('id-questioned') or '').casefold() in ('yes','true'):
        return None
    if str(rec.get('playback-used') or rec.get('playbackUsed') or '').casefold() in ('yes','true'):
        return None
    if url.startswith('//'):
        url='https:'+url
    parsed=urlparse(url)
    if parsed.scheme!='https' or parsed.hostname not in ('xeno-canto.org','www.xeno-canto.org','xeno-canto.s3.amazonaws.com'):
        return None
    return {'recordingId':'XC'+rid,'id':rid,'url':url,'source':'https://xeno-canto.org/'+rid,
            'sourceTaxon':taxon,'license':license_url,'author':name[:200],
            'quality':quality,'type':t[:120],'speciesHumanVerified':False}


def extra_xeno(latin, deadline):
    result={}
    for taxon in list(dict.fromkeys([latin]+ALIAS.get(latin,[]))):
        for page in (1,2):
            if time.monotonic()>deadline:
                break
            try:
                data=query_page(taxon,page)
            except RuntimeError as exc:
                print('XENO SEARCH ISSUE',latin,str(exc)[:115],flush=True)
                break
            for rec in data.get('recordings',[]):
                cand=check_recording(rec,taxon) or soft_xeno(rec,taxon)
                if cand and cand['id'] not in result:
                    result[cand['id']]=cand
            if len(data.get('recordings',[]))<100 or len(result)>25:
                break
            time.sleep(.5)
        time.sleep(.4)
    return sorted(result.values(),key=lambda x:('ABC'.index(x['quality']),
            0 if 'song' in x['type'].lower() else 1,int(x['id'])))[:12]


def safe_inat_download(url, dest):
    parsed=urlparse(url)
    host=parsed.hostname or ''
    if parsed.scheme!='https' or not (host=='inaturalist.org' or host.endswith('.inaturalist.org') or host=='inaturalist-open-data.s3.amazonaws.com'):
        raise ValueError('Untrusted iNaturalist download host')
    request=Request(url,headers={'User-Agent':SRC_UA})
    with urlopen(request,timeout=35) as response:
        final=urlparse(response.geturl())
        final_host=final.hostname or ''
        if final.scheme!='https' or not (final_host=='inaturalist.org' or final_host.endswith('.inaturalist.org') or final_host=='inaturalist-open-data.s3.amazonaws.com'):
            raise ValueError('Unexpected iNaturalist redirect')
        if int(response.headers.get('Content-Length') or 0)>MAX_DOWNLOAD_BYTES:
            raise ValueError('Source recording too large')
        n=0
        with dest.open('wb') as stream:
            while True:
                chunk=response.read(131072)
                if not chunk:
                    break
                n+=len(chunk)
                if n>MAX_DOWNLOAD_BYTES:
                    raise ValueError('Source recording exceeds size limit')
                stream.write(chunk)
    if n<3500:
        raise ValueError('Source recording too short')


def load_inat():
    path=OUT/'voice-candidates85.json'
    if not path.is_file():
        return {}
    raw=json.loads(path.read_text(encoding='utf-8'))
    return {record.get('latin'):record.get('candidates',[]) for record in raw.get('results',[])}


def promote(bird, item, file, existing_hashes, metrics):
    """Copy into new path; never touch original 265 audio files."""
    if bird.get('audioFile'):
        raise ValueError('Species has an existing main recording')
    digest=filehash(file)
    if digest in existing_hashes:
        raise ValueError('Audio duplicates a different catalog recording')
    filename=bird['latin'].lower().replace(' ','-')+'-'+str(item['recordingId']).lower().replace(':','-')+'.mp3'
    dest=APP/'media'/'audio'/filename
    if dest.exists():
        raise ValueError('Refusing to overwrite existing voice file')
    dest.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(file,dest)
    if filehash(dest)!=digest:
        raise ValueError('Copy hash mismatch')
    bird['audioFile']='media/audio/'+filename
    bird['audioCredits']={
        'source':item['source'], 'author':item['author'],
        'license':item['license'], 'licenseUrl':item['license'],
        'recordingId':item['recordingId'], 'sourcePlatform':item['sourcePlatform'],
        'sourceTaxon':item.get('sourceTaxon') or bird['latin'],
        'vocalization':item.get('type') or 'Звуковой сигнал',
        'recordingQuality':item.get('quality') or 'не указано',
        'audioReview':'Автоматически проверены вид в метаданных, лицензия и техническое качество; не прослушано человеком.',
        'reviewStatus':'awaiting-user-review',
        'speciesHumanVerified':False,'audioQuality':metrics,
        'sha256':digest,
    }
    existing_hashes.add(digest)
    return {'latin':bird['latin'],'name':bird['name'],'source':item['source'],
            'recordingId':item['recordingId'],'author':item['author'],'license':item['license'],
            'file':bird['audioFile'],'sha256':digest,'quality':item.get('quality',''),
            'reviewStatus':'awaiting-user-review','technical':metrics}


def main(minimum=1):
    birds=read_catalog()
    species=dict(catalog_missing())
    baseline=json.loads((ROOT/'data'/'voice-baseline85.json').read_text(encoding='utf-8'))
    originals={record['latin']:record for record in baseline['records']}
    by_taxon={b['latin']:b for b in birds}
    if len(originals)!=265 or set(species)&set(originals):
        raise ValueError('Invalid 265/33 species split')
    old_hashes=set()
    for latin,record in originals.items():
        bird=by_taxon[latin]
        if not bird.get('audioFile'):
            raise ValueError('Original species lost: '+latin)
        original=APP/record['file']
        if filehash(original)!=record['sha256']:
            raise ValueError('Baseline original modified: '+latin)
        old_hashes.add(record['sha256'])
    hashes=set(old_hashes)
    data_path=OUT/'voice-candidates87.json'
    existing=json.loads(data_path.read_text(encoding='utf-8')) if data_path.exists() else {'entries':[]}
    old_preview={e['latin']:e for e in existing.get('entries',[])}
    inat=load_inat()
    ffmpeg=ffmpeg_path()
    imported=[]; missed=[]; deadline=time.monotonic()+490
    for index,(latin,name) in enumerate(species.items(),1):
        bird=by_taxon[latin]
        if bird.get('audioFile'):
            missed.append({'latin':latin,'reason':'already present in generated catalog'})
            continue
        selected=None
        x=old_preview.get(latin)
        if x:
            p=APP/x['file']
            if p.is_file() and filehash(p)==x['sha256']:
                selected=dict(x)
                selected['sourcePlatform']='Xeno-canto'
                selected['metrics']=x['metrics']
                selected['filePath']=p
        if not selected and time.monotonic()<deadline:
            for item in extra_xeno(latin,deadline):
                if time.monotonic()>deadline:
                    break
                dest=PREVIEWS/(latin.lower().replace(' ','-')+'-xc'+item['id']+'.mp3')
                try:
                    with tempfile.TemporaryDirectory() as tmp:
                        raw=Path(tmp)/'source.bin'
                        download_source(item['url'],raw)
                        transcode(raw,dest,ffmpeg)
                    quality=verify_audio(dest)
                    if filehash(dest) in hashes:
                        raise ValueError('Cross-species duplicate')
                    item.update({'sourcePlatform':'Xeno-canto','metrics':quality,'filePath':dest})
                    selected=item
                    break
                except (ValueError,OSError,subprocess.TimeoutExpired) as ex:
                    dest.unlink(missing_ok=True)
                    print('XC SKIP',latin,item['recordingId'],str(ex)[:80],flush=True)
                except Exception as ex:
                    dest.unlink(missing_ok=True)
                    print('XC FETCH FAILED',latin,item['recordingId'],type(ex).__name__,flush=True)
        if not selected and time.monotonic()<deadline:
            for item in inat.get(latin,[])[:8]:
                lic=LICENSES.get(str(item.get('license') or '').lower())
                src=item.get('download_url') or ''
                obs=item.get('observation') or ''
                author=item.get('author') or ''
                soundid=str(item.get('sound_id') or '')
                if not lic or not author or not soundid.isdecimal() or not obs.startswith('https://www.inaturalist.org/observations/'):
                    continue
                dest=PREVIEWS/(latin.lower().replace(' ','-')+'-inat'+soundid+'.mp3')
                try:
                    with tempfile.TemporaryDirectory() as tmp:
                        raw=Path(tmp)/'source.bin'
                        safe_inat_download(src,raw)
                        transcode(raw,dest,ffmpeg)
                    quality=verify_audio(dest)
                    if filehash(dest) in hashes:
                        raise ValueError('Cross-species duplicate')
                    selected={'recordingId':'iNat:'+soundid,'source':obs,
                              'sourceTaxon':latin,'sourcePlatform':'iNaturalist',
                              'license':lic,'author':author,'quality':'research-grade observation',
                              'type':'Запись наблюдения; тип звука требует проверки',
                              'filePath':dest,'metrics':quality}
                    break
                except (ValueError,OSError,subprocess.TimeoutExpired) as ex:
                    dest.unlink(missing_ok=True)
                    print('INAT SKIP',latin,soundid,str(ex)[:80],flush=True)
                except Exception as ex:
                    dest.unlink(missing_ok=True)
                    print('INAT FETCH FAILED',latin,soundid,type(ex).__name__,flush=True)
        if selected:
            try:
                imported.append(promote(bird,selected,selected['filePath'],hashes,selected['metrics']))
            except (OSError,ValueError) as ex:
                missed.append({'latin':latin,'reason':'promotion rejected: '+str(ex)[:120]})
        else:
            missed.append({'latin':latin,'reason':'no downloadable candidate passed exact taxon / media license / signal checks'})
        print('%02d/33 %s: %s'%(index,latin,'attached' if selected and bird.get('audioFile') else 'not added'),flush=True)
    # No partial catalog write if integrity or minimum gates fail.
    added=len(imported)
    if added<minimum:
        raise RuntimeError('Only '+str(added)+' new sounds met checks; require '+str(minimum))
    for latin,record in originals.items():
        if filehash(APP/record['file'])!=record['sha256']:
            raise ValueError('Original archive regression after ingestion: '+latin)
    count=sum(bool(b.get('audioFile')) for b in birds)
    if count!=265+added:
        raise ValueError('Voice count mismatch')
    CAT.write_text('window.BIRDS_DATA='+json.dumps(birds,ensure_ascii=False,separators=(',',':'))+';',encoding='utf-8')
    report=json.loads(COVERAGE.read_text(encoding='utf-8'))
    report.update(birdCalls=count,missingAudio=[b['latin'] for b in birds if not b.get('audioFile')])
    report['userReviewPending88']={'newVoices':added,'originalVoices':265,'humanReviewedNew':0,
            'note':'New authentic-source licensed media are playable without pre-listening; species identities are not independently verified.'}
    report['audioTechnicalAccepted']=count
    report['audioTechnicalRejected']=0
    for key in ('milestone150','milestone200','milestone250','milestone298'):
        if isinstance(report.get(key),dict):
            goal=int(report[key].get('target') or key.replace('milestone',''))
            report[key].update(verifiedAudioSpecies=count,shortfall=max(0,goal-count),achieved=count>=goal)
    COVERAGE.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    result={'baseline265Preserved':True,'newMainVoices':added,'catalogVoices':count,'missingVoices':298-count,
            'humanReviewedNew':0,'added':imported,'notAdded':missed}
    OUT.mkdir(parents=True,exist_ok=True)
    (OUT/'imported-voices88.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print('NEW VOICE IMPORT',json.dumps({'attached':added,'total':count,'remaining':298-count,
          'baselineUnchanged':True,'humanReviewedNew':0},ensure_ascii=False),flush=True)
    return result


if __name__=='__main__':
    ap=argparse.ArgumentParser()
    ap.add_argument('--min',type=int,default=1)
    args=ap.parse_args()
    main(max(1,args.min))
