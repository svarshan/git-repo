#!/usr/bin/env python3
"""MoOLVa 2.6 Voices MAX — species-authenticated, redistribution-permitted audio.
The optional xeno-canto v3 API requires an owner-supplied XENO_CANTO_API_KEY secret.
Without it we search alternate exact-species Wikimedia Commons sound files.
No human voice detection/ornithological listening is claimed.
"""
from concurrent.futures import ThreadPoolExecutor,as_completed
from pathlib import Path
from urllib.parse import urlparse
import json,os,re,time,threading,requests

from make_catalog import APP,ROOT,M,COMMONS,lic,valid_existing_media
from harvest_voices import SYNONYMS,match_scientific,BAD_TITLE,POSITIVE

DATA=APP/'data.js'
REPORT=ROOT/'data'/'coverage.json'
KEY=os.environ.get('XENO_CANTO_API_KEY','').strip()
STOP=float('inf')
TLS=threading.local()
PACE=threading.Lock()
NEXT=[0.0]
MAX_SIZE=9_000_000
AUDIO={'audio/ogg':'ogg','application/ogg':'ogg','audio/mpeg':'mp3','audio/wav':'wav','audio/x-wav':'wav'}
BLOCK=re.compile(r'(?:human speech|speech|interview|conversation|voiceover|podcast|birds? imitation|human voices|mixed chorus|radio programme|music)',re.I)
def client():
 if not hasattr(TLS,'s'):
  TLS.s=requests.Session()
  TLS.s.headers.update({'User-Agent':'MoOLVa-Birds-NN/2.6 (educational, github.com/svarshan/git-repo)','Accept':'application/json'})
 return TLS.s
def get_json(url,params):
 if time.monotonic()>=STOP:return {}
 for retry in range(2):
  if time.monotonic()>=STOP:return {}
  try:
   r=client().get(url,params=params,timeout=(5,11))
   if r.status_code in (429,500,502,503,504):
    time.sleep(retry+1.0);continue
   r.raise_for_status()
   return r.json()
  except (requests.RequestException,ValueError):
   if retry==0:time.sleep(.5)
 return {}
def license_ok(value):
 s=str(value or '').lower().replace('_','-')
 if not s or any(x in s for x in ('by-nc','by-nd','nc-sa','nc-nd','noncommercial','no-derivatives')):return False
 return bool(re.search(r'creativecommons\.org/licenses/by(?:-sa)?/\d|creativecommons\.org/publicdomain/zero/|creativecommons\.org/publicdomain/mark/',s))
def soundtype(value):
 v=str(value or '').lower()
 if re.search(r'\balarm\b|тревог',v):return 'Тревожный сигнал'
 if re.search(r'\bcall\b|contact|позыв|крик',v):return 'Позывка'
 if re.search(r'\bsong\b|sing|песн|пени',v):return 'Песня'
 return 'Звуковой сигнал'
def xeno_choices(b):
 if not KEY:return []
 result=[]
 for name in list(dict.fromkeys([b['latin']]+SYNONYMS.get(b['latin'],[])))[:3]:
  if time.monotonic()>=STOP:break
  tokens=name.split()
  if len(tokens)!=2:continue
  response=get_json('https://xeno-canto.org/api/3/recordings',
         {'query':'gen:'+tokens[0]+' sp:'+tokens[1]+' grp:birds','key':KEY,'per_page':100})
  for r in (response.get('recordings') or []):
   gen=str(r.get('gen') or '').lower();sp=str(r.get('sp') or '').lower()
   if gen!=tokens[0].lower() or sp!=tokens[1].lower():continue
   if str(r.get('q') or '').upper() not in ('A','B','C'):continue
   if not license_ok(r.get('lic')):continue
   if BLOCK.search(' '.join(str(r.get(x) or '') for x in ('rmk','type','also','en'))):continue
   if r.get('file') is None or not str(r['file']).strip():continue
   url=str(r['file']).strip()
   if url.startswith('//'):url='https:'+url
   if not url.startswith('https://'):continue
   identifier=str(r.get('id') or '')
   if not identifier.isdigit():continue
   license_url=str(r['lic'])
   if license_url.startswith('//'):license_url='https:'+license_url
   credit={'author':str(r.get('rec') or 'xeno-canto contributor'),
     'license':license_url,'licenseUrl':license_url,
     'source':'https://xeno-canto.org/'+identifier,'recordingId':'XC'+identifier,
     'vocalization':soundtype(r.get('type')),
     'speciesMatch':'genus+species fields verified in xeno-canto v3',
     'recordingQuality':str(r.get('q') or '').upper(),
     'audioReview':'species/rights metadata verified; no individual auditory inspection'}
   rank=('ABC'.index(str(r.get('q')).upper()),0 if credit['vocalization']=='Песня' else 1,
        0 if str(r.get('cnt') or '').lower() in ('russia','ru') else 1)
   result.append((rank,url,'mp3',credit))
  if result:break
 result.sort(key=lambda x:x[0])
 return result[:8]
def commons_choices(b):
 names=list(dict.fromkeys([b['latin']]+SYNONYMS.get(b['latin'],[])))
 found=[]
 # Search across multilingual file captions, all licensed Commons audio;
 # scientific binomial in title remains mandatory for taxonomic correctness.
 for name in names[:3]:
  if time.monotonic()>=STOP:break
  response=get_json(COMMONS,{'action':'query','format':'json','formatversion':'2',
   'generator':'search','gsrsearch':'filetype:audio "'+name+'"',
   'gsrnamespace':'6','gsrlimit':'50','prop':'imageinfo',
   'iiprop':'url|size|mime|extmetadata'})
  for page in (response.get('query') or {}).get('pages',[]):
   title=str(page.get('title') or '')
   if not match_scientific(title,names) or BAD_TITLE.search(title):continue
   info=(page.get('imageinfo') or [{}])[0]
   mime=str(info.get('mime') or '')
   if mime not in AUDIO or int(info.get('size') or 0)>MAX_SIZE:continue
   license=lic(info)
   if not license:continue
   url=info.get('url')
   if not url:continue
   license['vocalization']=soundtype(title)
   license['speciesMatch']='scientific binomial in Commons file title'
   license['audioReview']='rights/taxon title checked; no individual auditory inspection'
   rank=(0,0 if POSITIVE.search(title) else 1,abs(int(info.get('size') or 0)-300000))
   found.append((rank,url,AUDIO[mime],license))
  if found:break
 found.sort(key=lambda x:x[0])
 return found[:8]
def download(url,dst):
 if time.monotonic()>=STOP:return False
 src=(urlparse(url).hostname or '').lower()
 if not (src in ('xeno-canto.org','www.xeno-canto.org','upload.wikimedia.org') or src.endswith('.wikimedia.org')):return False
 try:
  with client().get(url,stream=True,timeout=(6,22)) as r:
   r.raise_for_status()
   final=(urlparse(r.url).hostname or '').lower()
   if not (final in ('xeno-canto.org','www.xeno-canto.org','upload.wikimedia.org',
                     'xeno-canto.s3.amazonaws.com') or final.endswith('.wikimedia.org')):return False
   if int(r.headers.get('Content-Length') or 0)>MAX_SIZE:return False
   dst.parent.mkdir(parents=True,exist_ok=True)
   n=0
   with dst.open('wb') as out:
    for block in r.iter_content(65536):
     if time.monotonic()>=STOP:raise ValueError('Budget expired')
     n+=len(block)
     if n>MAX_SIZE:raise ValueError('File too large')
     out.write(block)
   if n<3000:return False
   header=dst.open('rb').read(16)
   ext=dst.suffix.lower()
   return (ext=='.mp3' and (header[:3]==b'ID3' or header[:1]==b'\xff')) or \
          (ext=='.ogg' and header[:4]==b'OggS') or \
          (ext=='.wav' and header[:4]==b'RIFF')
 except (OSError,ValueError,requests.RequestException):
  return False
 finally:
  if dst.exists() and dst.stat().st_size<3000:dst.unlink(missing_ok=True)
def enrich(b):
 if valid_existing_media(b,'audioFile'):return b,None
 items=xeno_choices(b)
 if not items:items=commons_choices(b)
 for _,url,ext,credit in items:
  if time.monotonic()>=STOP:break
  dst=M/'audio'/(b['id']+'.'+ext)
  if download(url,dst):
   b['audioFile']='media/audio/'+dst.name
   b['audioCredits']=credit
   return b,'xeno-canto' if 'xeno-canto' in credit['source'] else 'Commons'
  dst.unlink(missing_ok=True)
 return b,None
def checkpoint(birds,stats):
 DATA.write_text('window.BIRDS_DATA='+json.dumps(birds,ensure_ascii=False,separators=(',',':'))+';',encoding='utf8')
 report=json.loads(REPORT.read_text('utf8'))
 report['birdCalls']=sum(bool(b.get('audioFile')) for b in birds)
 report['missingAudio']=[b['latin'] for b in birds if not b.get('audioFile')]
 report['maxVoices']={'xenoApiKeyConfigured':bool(KEY),'newSources':stats,'missingSpecies':len(report['missingAudio'])}
 REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
 return report
def main():
 global STOP
 raw=DATA.read_text('utf8').strip()
 if not raw.startswith('window.BIRDS_DATA='):raise ValueError('Missing catalog')
 birds=json.loads(raw[len('window.BIRDS_DATA='):].rstrip(';'))
 if len(birds)!=298:raise ValueError('Expected audited 298 species')
 STOP=time.monotonic()+max(90,min(1200,int(os.environ.get('BIRDS_MAX_BUDGET_SECONDS','600'))))
 todo=[i for i,b in enumerate(birds) if not valid_existing_media(b,'audioFile')]
 stats={'xeno-canto':0,'Commons':0}
 print('VOICES MAX: missing',len(todo),'xeno API key configured:',bool(KEY),flush=True)
 checkpoint(birds,stats)
 count=0
 for base in range(0,len(todo),10):
  if time.monotonic()>=STOP:break
  indexes=todo[base:base+10]
  with ThreadPoolExecutor(max_workers=5) as exe:
   jobs={exe.submit(enrich,birds[i]):i for i in indexes}
   for done in as_completed(jobs):
    idx=jobs[done]
    try:
     birds[idx],origin=done.result()
     if origin:stats[origin]+=1
    except Exception as e:print('VOICES MAX WARN',birds[idx]['latin'],str(e)[:140],flush=True)
    count+=1
  report=checkpoint(birds,stats)
  print('VOICES MAX PROGRESS',count,'/',len(todo),'total voices',report['birdCalls'],stats,flush=True)
 report=checkpoint(birds,stats)
 print('VOICES MAX FINAL',json.dumps({'birdCalls':report['birdCalls'],'missing':len(report['missingAudio']),
                                     'keyPresent':bool(KEY),'sources':stats},ensure_ascii=False),flush=True)
if __name__=='__main__':main()
