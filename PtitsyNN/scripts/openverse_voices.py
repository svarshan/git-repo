#!/usr/bin/env python3
"""Optional second audio source: Openverse CC BY / CC BY-SA / CC0 audio index.

Strict taxonomic title matching, secure download hosts, file-specific creator,
landing page and license. Ambient soundscapes or unlabelled birds are excluded.
No third-party source is bundled without an explicit redistribution license.
"""
import json,os,re,threading,time
from concurrent.futures import ThreadPoolExecutor,as_completed
from pathlib import Path
from urllib.parse import urlparse
import requests
from make_catalog import APP,ROOT,M,valid_existing_media
from harvest_voices import SYNONYMS, match_scientific, BAD_TITLE, POSITIVE

DATA=APP/'data.js'
REPORT=ROOT/'data'/'coverage.json'
API='https://api.openverse.org/v1/audio/'
STOP=float('inf')
LOCK=threading.Lock()
LAST=[0.]
VALID={'by','by-sa','cc0','pdm'}
SIZE=8_000_000
def download(url,target):
 hostname=(urlparse(url).hostname or '').lower()
 # Only known media hosts for the indexed source. Never fetch unknown arbitrary URLs.
 if not(hostname=='cdn.freesound.org' or hostname=='freesound.org' or
        hostname=='upload.wikimedia.org' or hostname=='archive.org' or
        hostname.endswith('.archive.org')):return False
 try:
  with requests.get(url,stream=True,timeout=(5,15),headers={'User-Agent':'MoOLVa-BirdsNN/2.4 (github.com/svarshan/git-repo)'}) as r:
   r.raise_for_status()
   if int(r.headers.get('Content-Length') or 0)>SIZE:return False
   target.parent.mkdir(parents=True,exist_ok=True)
   size=0
   with target.open('wb') as f:
    for chunk in r.iter_content(65536):
     if time.monotonic()>=STOP:raise ValueError('Deadline')
     size+=len(chunk)
     if size>SIZE:raise ValueError('Too large')
     f.write(chunk)
   head=target.open('rb').read(16)
   if size<250:return False
   ext=target.suffix.lower()
   return (ext=='.mp3' and (head.startswith(b'ID3') or head.startswith(b'\xff'))) or \
          (ext=='.ogg' and head.startswith(b'OggS')) or (ext=='.wav' and head.startswith(b'RIFF'))
 except (requests.RequestException,ValueError,OSError):
  return False
 finally:
  if target.is_file() and target.stat().st_size<250:target.unlink(missing_ok=True)
def query(term):
 with LOCK:
  gap=LAST[0]-time.monotonic()
  if gap>0:time.sleep(gap)
  LAST[0]=time.monotonic()+0.7
 if time.monotonic()>=STOP:return []
 try:
  r=requests.get(API,params={'q':term,'license':'by,by-sa,cc0,pdm','page_size':20,'category':'sound_effect'},
                 headers={'User-Agent':'MoOLVa-BirdsNN/2.4 (github.com/svarshan/git-repo)'},
                 timeout=(5,12))
  if r.status_code in (429,403):return []
  r.raise_for_status()
  return r.json().get('results',[])
 except (ValueError,requests.RequestException,AttributeError):return []
def options(b):
 names=list(dict.fromkeys([b['latin']]+SYNONYMS.get(b['latin'],[])))
 result=[]
 for name in names[:2]:
  if time.monotonic()>=STOP:break
  for row in query(name):
   title=str(row.get('title') or '')
   if BAD_TITLE.search(title):continue
   if not match_scientific(title,names):continue
   if (row.get('license') or '').lower() not in VALID:continue
   page=str(row.get('foreign_landing_url') or '')
   if not re.match(r'^https://(?:freesound\.org/(?:people|s)/|archive\.org/details/|commons\.wikimedia\.org/wiki/)',page):continue
   media=str(row.get('url') or '')
   if not media.startswith('https://'):continue
   suffix=urlparse(media).path.lower()
   ext='mp3' if suffix.endswith('.mp3') else 'ogg' if suffix.endswith(('.ogg','.oga')) else 'wav' if suffix.endswith('.wav') else None
   if not ext:continue
   licensed=(row['license'] or '').lower()
   credit={'author':str(row.get('creator') or 'Автор указан на странице записи'),
     'source':page,'license':licensed.upper()+' '+str(row.get('license_version') or ''),
     'licenseUrl':str(row.get('license_url') or ''),
     'speciesMatch':'exact scientific name in recording title',
     'audioReview':'license and taxon title checked, individual listening not audited',
     'index':'Openverse'}
   order=(0 if POSITIVE.search(title) else 1, int(row.get('duration') or 0))
   result.append((order,media,ext,credit))
 if result:result.sort(key=lambda x:x[0])
 return result[:7]
def enrich(b):
 if valid_existing_media(b,'audioFile'):return b,False
 for _,url,ext,credit in options(b):
  if time.monotonic()>=STOP:break
  dst=M/'audio'/(b['id']+'.'+ext)
  if download(url,dst):
   b['audioFile']='media/audio/'+dst.name
   b['audioCredits']=credit
   return b,True
  dst.unlink(missing_ok=True)
 return b,False
def save(birds):
 DATA.write_text('window.BIRDS_DATA='+json.dumps(birds,ensure_ascii=False,separators=(',',':'))+';',encoding='utf8')
 r=json.loads(REPORT.read_text(encoding='utf8')) if REPORT.exists() else {}
 r['birdCalls']=sum(bool(x.get('audioFile')) for x in birds)
 r['missingAudio']=[b['latin'] for b in birds if not b.get('audioFile')]
 r['audioSources']={src:sum(bool(b.get('audioFile')) and src in str((b.get('audioCredits') or {}).get('source',''))
  for b in birds) for src in ('wikimedia.org','freesound.org','archive.org','xeno-canto.org','inaturalist.org')}
 REPORT.write_text(json.dumps(r,ensure_ascii=False,indent=2),encoding='utf8')
 return r
def main():
 global STOP
 raw=DATA.read_text(encoding='utf8').strip()
 assert raw.startswith('window.BIRDS_DATA=')
 birds=json.loads(raw[len('window.BIRDS_DATA='):].rstrip(';'))
 assert len(birds)==298
 STOP=time.monotonic()+max(30,min(700,int(os.getenv('BIRDS_OPENVERSE_BUDGET_SECONDS','550'))))
 remaining=[i for i,b in enumerate(birds) if not valid_existing_media(b,'audioFile')]
 print('OPENVERSE FREE-LICENSE VOICES',len(remaining),'missing; exact species matching',flush=True)
 count=0
 for start in range(0,len(remaining),12):
  if time.monotonic()>=STOP:break
  ids=remaining[start:start+12]
  with ThreadPoolExecutor(max_workers=4) as pool:
   futs={pool.submit(enrich,birds[i]):i for i in ids}
   for fut in as_completed(futs):
    try:
     birds[futs[fut]],ok=fut.result()
     if ok:count+=1
    except Exception as e:print('OPENVERSE WARN',str(e)[:130],flush=True)
  report=save(birds)
  print('OPENVERSE PROGRESS',start+len(ids),'/',len(remaining),'new',count,'total',report['birdCalls'],flush=True)
 final=save(birds)
 print('OPENVERSE FINAL',{'new':count,'birdCalls':final['birdCalls'],'missing':len(final['missingAudio'])},flush=True)
if __name__=='__main__':main()
