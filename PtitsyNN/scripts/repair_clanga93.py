#!/usr/bin/env python3
"""Replace user-reported wind-only Clanga clanga audio with licensed adult calls.

Xeno-canto recording quality describes recording fidelity, NOT species verification.
Only whitelisted adult call recordings are considered. New audio is still marked
awaiting user review; download/signal processing cannot verify a bird by ear.
"""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
from urllib.parse import urlparse
import numpy as np
from xeno_candidates87 import query_page
from stage_xeno87 import download_source, ffmpeg_path
from audit_audio import inspect

ROOT=Path(__file__).resolve().parents[1]
APP=ROOT/'app'
OUT=ROOT/'dist'/'release-evidence'/'eagle-repair93.json'
IDS=('371196','371198','460234','983557','981181','460224')
BAD_ID='19688'
BAD_NOTES=re.compile(r'windy|strong wind|wind noise|speech|talking|conversation|hybrid|other species|background only|playback|imitation|uncertain',re.I)
PERMITTED=re.compile(r'^/licenses/(by|by-sa|by-nc-sa)/(2\.0|2\.5|3\.0|4\.0)/?$')

def safe_license(raw):
    raw=str(raw or '').strip()
    if raw.startswith('//'):raw='https:'+raw
    parsed=urlparse(raw)
    if parsed.scheme!='https' or parsed.hostname not in ('creativecommons.org','www.creativecommons.org'):
        return ''
    if not PERMITTED.fullmatch(parsed.path):
        return ''
    return 'https://creativecommons.org'+parsed.path.rstrip('/')+'/'

def inspect_candidate(rec):
    if not isinstance(rec,dict) or str(rec.get('id')) not in IDS:
        return None
    if str(rec.get('gen','')).casefold()!='clanga' or str(rec.get('sp','')).casefold()!='clanga':
        return None
    if str(rec.get('q','')).upper() not in ('A','B') or not re.search(r'\bcall\b',str(rec.get('type','')),re.I):
        return None
    if str(rec.get('playback-used') or rec.get('playbackUsed') or '').lower() in ('yes','true'):
        return None
    if str(rec.get('id-questioned') or '').lower() in ('yes','true'):
        return None
    if BAD_NOTES.search(str(rec.get('rmk') or '')+' '+str(rec.get('type') or '')+' '+str(rec.get('ssp') or '')):
        return None
    also=rec.get('also') or []
    if isinstance(also,list) and any(str(x).strip() for x in also):
        return None
    if isinstance(also,str) and also.strip() not in ('','[]'):
        return None
    lic=safe_license(rec.get('lic'))
    url=str(rec.get('file') or '').strip()
    if url.startswith('//'):url='https:'+url
    host=urlparse(url)
    if not lic or host.scheme!='https' or host.hostname not in (
        'xeno-canto.org','www.xeno-canto.org','xeno-canto.s3.amazonaws.com'
    ) or not str(rec.get('rec') or '').strip():
        return None
    return {'id':str(rec['id']),'url':url,'licenseUrl':lic,'author':str(rec['rec']).strip()[:200],
            'type':str(rec.get('type') or '')[:120],'quality':str(rec.get('q'))}

def make_clean(source,destination):
    ff=ffmpeg_path()
    command=[ff,'-nostdin','-hide_banner','-loglevel','error','-y','-i',str(source),
             '-t','45','-vn','-ac','1','-ar','32000',
             '-af','highpass=f=350,lowpass=f=6800',
             '-c:a','libmp3lame','-q:a','4',str(destination)]
    done=subprocess.run(command,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,timeout=95)
    if done.returncode or not destination.is_file() or destination.stat().st_size<3000:
        raise ValueError('Band-filtered adult call could not be decoded')
    return inspect(destination)

def signal_contrast(path):
    ff=ffmpeg_path()
    command=[ff,'-nostdin','-hide_banner','-loglevel','error',
             '-i',str(path),'-vn','-ac','1','-ar','8000','-f','f32le','-']
    result=subprocess.run(command,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=70)
    if result.returncode:raise ValueError('Signal decode failed')
    samples=np.frombuffer(result.stdout,dtype='<f4')
    n=len(samples)//2000
    if n<16:raise ValueError('Signal too short for contrast QA')
    frames=samples[:n*2000].reshape(n,2000)
    rms=np.sqrt(np.mean(frames.astype(np.float64)**2,axis=1))+1e-8
    contrast=20*np.log10(float(np.percentile(rms,95))/float(np.percentile(rms,30)))
    if contrast<6:
        raise ValueError('No clear discrete sound over background; contrast %.1f dB'%contrast)
    return round(float(contrast),2)

def run():
    raw=(APP/'data.js').read_text(encoding='utf8').strip()
    prefix='window.BIRDS_DATA='
    if not raw.startswith(prefix):raise ValueError('Invalid catalog')
    birds=json.loads(raw[len(prefix):].rstrip(';'))
    if len(birds)!=298:raise ValueError('Wrong number of birds')
    eagle=next(b for b in birds if b['latin']=='Clanga clanga')
    before=eagle.get('audioFile')
    credit=eagle.get('audioCredits') or {}
    errors=[]
    accepted=None
    if credit.get('recordingId','').removeprefix('XC') in IDS and before and (APP/before).is_file():
        accepted={'recordingId':credit['recordingId'],'source':credit.get('source'),'retained':True}
    elif os.environ.get('XENO_CANTO_API_KEY','').strip():
        try:
            result=query_page('Clanga clanga',1)
            matches={str(r.get('id')):r for r in result.get('recordings',[]) if isinstance(r,dict)}
            for ident in IDS:
                rec=inspect_candidate(matches.get(ident))
                if not rec:
                    errors.append('XC'+ident+': metadata/license not eligible')
                    continue
                try:
                    with tempfile.TemporaryDirectory() as folder:
                        original=Path(folder)/'recording.bin'
                        encoded=Path(folder)/'clean.mp3'
                        download_source(rec['url'],original)
                        metrics=make_clean(original,encoded)
                        metrics['signalContrastDb']=signal_contrast(encoded)
                        blob=encoded.read_bytes()
                        digest=hashlib.sha256(blob).hexdigest()
                        if any((b.get('audioCredits') or {}).get('sha256')==digest for b in birds if b is not eagle):
                            raise ValueError('Duplicate of another bird')
                        output=APP/'media'/'audio'/('clanga-clanga-xc'+ident+'-filtered.mp3')
                        output.parent.mkdir(parents=True,exist_ok=True)
                        output.write_bytes(blob)
                    noncommercial='/by-nc-' in rec['licenseUrl']
                    eagle['audioFile']='media/audio/'+output.name
                    eagle['audioTracks']=[]
                    eagle.pop('audioCleanFile85',None)
                    eagle['audioCredits']={
                        'source':'https://xeno-canto.org/'+ident,
                        'author':rec['author'],
                        'license':('CC BY-NC-SA' if noncommercial else 'CC BY-SA' if '/by-sa/' in rec['licenseUrl'] else 'CC BY')+' '+rec['licenseUrl'].rstrip('/').split('/')[-1],
                        'licenseUrl':rec['licenseUrl'],'recordingId':'XC'+ident,
                        'sourcePlatform':'Xeno-canto','sourceTaxon':'Clanga clanga',
                        'vocalization':rec['type'],'recordingQuality':rec['quality'],
                        'audioQuality':metrics,'sha256':digest,
                        'reviewStatus':'awaiting-user-review','speciesHumanVerified':False,
                        'noncommercialOnly':noncommercial,
                        'audioProcessing':'Убраны низкие частоты ветра фильтром 350 Гц, обрезано до 45 секунд, MP3 32 кГц.',
                        'audioReview':'Метаданные, лицензия, сигнал и оригинальный файл проверены автоматически; на слух не подтверждено.',
                        'licenseNotice':'Требуется указание автора и соблюдение лицензии источника.'
                    }
                    accepted={'recordingId':'XC'+ident,'source':eagle['audioCredits']['source'],
                              'sha256':digest,'technical':metrics,'retained':False}
                    break
                except (OSError,ValueError,subprocess.TimeoutExpired) as exc:
                    errors.append('XC'+ident+': '+str(exc)[:140])
                except Exception as exc:
                    errors.append('XC'+ident+': download error '+type(exc).__name__)
        except Exception as exc:
            errors.append('Xeno-canto query: '+type(exc).__name__+' '+str(exc)[:90])
    else:
        errors.append('XENO_CANTO_API_KEY missing; could not download approved alternative')
    if not accepted:
        # Fail closed: no wind-only, unknown, or incorrectly labelled replacement.
        eagle['audioFile']=None
        eagle['audioCredits']=None
        eagle['audioTracks']=[]
        eagle.pop('audioCleanFile85',None)
    (APP/'data.js').write_text(prefix+json.dumps(birds,ensure_ascii=False,separators=(',',':'))+';',encoding='utf8')
    OUT.parent.mkdir(parents=True,exist_ok=True)
    report={'species':'Clanga clanga','rejected':'XC'+BAD_ID,'before':before,
            'after':eagle.get('audioFile'),'selected':accepted,'errors':errors,
            'humanVerified':False,'realVoiceConfirmed':False,
            'outcome':'candidate-unreviewed' if accepted else 'silenced-pending-clean-recording'}
    OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
    print('EAGLE AUDIO 93',json.dumps({'outcome':report['outcome'],'source':(accepted or {}).get('recordingId'),'rejections':len(errors)},ensure_ascii=False),flush=True)
    return report

if __name__=='__main__':run()
