#!/usr/bin/env python3
"""Build local, licensed media and encyclopedia texts from Wikimedia APIs.
No generated/artificial bird images or calls. Source credits retained per file.
This script runs on the GitHub Actions runner before Electron packaging.
"""
import base64
from concurrent.futures import ThreadPoolExecutor, as_completed
import html
import json
import os
from pathlib import Path
import re
import threading
import time
from urllib.parse import urlparse
import zlib
import requests

ROOT=Path(__file__).resolve().parents[1]
APP=ROOT/'app'
M=APP/'media'
WIKI='https://ru.wikipedia.org/w/api.php'
COMMONS='https://commons.wikimedia.org/w/api.php'
ENWIKI='https://en.wikipedia.org/w/api.php'
INAT='https://api.inaturalist.org/v1/observations'
XENO='https://xeno-canto.org/api/3/recordings'
XENO_KEY=os.environ.get('XENO_CANTO_API_KEY','').strip()
INAT_GAP=1.15  # <= 52 requests/minute, below iNaturalist recommended 60/minute
INAT_LOCK=threading.Lock()
INAT_NEXT=[0.0]
thread=threading.local()
FETCH_DEADLINE=float('inf')

def deadline_reached():
 return time.monotonic() >= FETCH_DEADLINE
UA=os.environ.get('BIRDS_USER_AGENT','MoOLVa Birds NN/2.1 (educational desktop encyclopedia; github.com/svarshan/git-repo)')
FREE=('CC BY','CC-BY','CC0','PUBLIC DOMAIN','PD-','PD ','PDM','PUBLICDOMAIN')
INVALID=('NC','ND','FAIR USE','COPYRIGHT','ALL RIGHTS','NONCOMMERCIAL')
GROUPS={
 'Хищные и совы':('Falco','Accipiter','Buteo','Aquila','Circus','Milvus','Haliaeetus','Pandion','Pernis','Strix','Asio','Bubo','Athene','Aegolius','Glaucidium','Tyto','Hieraaetus','Clanga','Ciconia'),
 'Водные и околоводные':('Anas','Anser','Cygnus','Aythya','Mergus','Branta','Fulica','Gallinula','Tachybaptus','Podiceps','Ardea','Egretta','Botaurus','Ixobrychus','Tringa','Calidris','Gallinago','Limosa','Numenius','Vanellus','Charadrius','Sterna','Larus','Chroicocephalus','Pluvialis','Haematopus','Rallus','Scolopax','Actitis','Phalacrocorax','Gavia','Grus','Porzana','Lymnocryptes','Mareca','Spatula','Bucephala','Melanitta','Clangula','Pelecanus'),
 'Дятлы':('Dendrocopos','Dryobates','Dendrocoptes','Picus','Dryocopus','Jynx','Picoides'),
}
def sess():
 if not hasattr(thread,'sess'):
  s=requests.Session()
  s.headers.update({'User-Agent':UA,'Accept':'application/json'})
  thread.sess=s
 return thread.sess
def query(url,params):
 args={'action':'query','format':'json','formatversion':'2',**params}
 for tries in range(2):
  if deadline_reached():return {}
  try:
   r=sess().get(url,params=args,timeout=(5,9))
   if r.status_code in (429,500,502,503,504):
    time.sleep(1.6*(tries+1))
    continue
   r.raise_for_status()
   obj=r.json()
   return obj.get('query',{}) if 'error' not in obj else {}
  except (requests.RequestException,ValueError):
   time.sleep(1.1*(tries+1))
 return {}
def plain(x):
 v=str(x or '')
 v=re.sub(r'<(script|style)\b[^>]*>.*?</\1>', '',v,flags=re.I|re.S)
 return html.unescape(' '.join(re.sub(r'<[^>]+>',' ',v).split()))[:350]
def lic(info):
 e=info.get('extmetadata') or {}
 val=lambda key: plain((e.get(key) or {}).get('value',''))
 name=val('LicenseShortName')
 n=name.upper().replace(' ','').replace('_','')
 if not (n.startswith(('CCBY','CC0','PD-','PUBLICDOMAIN','PDM')) or n=='PD'):
  return None
 if any(x in n for x in ('NC','ND','FAIRUSE','COPYRIGHT','ALLRIGHTS')):
  return None
 if not info.get('descriptionurl'):
  return None
 return {'author':val('Artist') or 'Автор указан на Wikimedia Commons','license':name,'source':info['descriptionurl'],'licenseUrl':val('LicenseUrl')}
def file_info(titles):
 result=query(COMMONS,{'titles':'|'.join(titles),'prop':'imageinfo','iiprop':'url|size|mime|extmetadata','iiurlwidth':'780'})
 out=[]
 for p in result.get('pages',[]):
  if p.get('missing'):continue
  for item in p.get('imageinfo',[]):
   credit=lic(item)
   if credit:out.append((p.get('title',''),item,credit))
 return out
def photo_from_wikipedia(bird, title):
 if not title:return None
 for name,inf,credit in file_info(['File:'+title.replace('File:','')]):
  mime=inf.get('mime','')
  if mime not in ('image/jpeg','image/png','image/webp'):continue
  if re.search(r'map|range|distribution|eggs|nest|drawing|sketch|diagram|illustration|logo',name,re.I):continue
  url=inf.get('thumburl') or inf.get('url')
  if url:return url,credit,mime
 return None
def media_search(latin,kind):
 q=query(COMMONS,{'generator':'search','gsrsearch':'"'+latin+'"','gsrnamespace':'6','gsrlimit':'50','prop':'imageinfo','iiprop':'url|size|mime|extmetadata','iiurlwidth':'780'})
 results=[]
 genus,species=latin.split(' ',1)
 for p in q.get('pages',[]):
  name=p.get('title','')
  if not re.search(r'(?<![a-z])'+re.escape(genus)+r'[ _.-]+'+re.escape(species)+r'(?![a-z])',name,re.I):continue
  if kind=='image' and re.search(r'map|range|distribution|eggs|nest|illustration|drawing|sketch|diagram',name,re.I):continue
  if kind=='audio' and not re.search(r'song|call|sound|voice|audio|sing|vocal|songbird|пени|крик|голос',name,re.I):continue
  info=(p.get('imageinfo') or [{}])[0]
  mime=info.get('mime','')
  if kind=='image' and mime not in ('image/jpeg','image/png','image/webp'):continue
  if kind=='audio' and mime not in ('audio/ogg','application/ogg','audio/mpeg','audio/wav','audio/x-wav'):continue
  max_orig=12_000_000 if kind=='image' else 5_000_000
  if info.get('size',0)>max_orig:continue
  credit=lic(info)
  url=(info.get('thumburl') or info.get('url')) if kind=='image' else info.get('url')
  if not credit or not url:continue
  results.append((len(name),url,credit,mime))
 results.sort(key=lambda x:x[0])
 return [(url,credit,mime) for _,url,credit,mime in results]

def allowed_cc(code):
 return str(code or '').strip().lower().replace('_','-') in ('cc0','cc-by','cc-by-sa','public-domain')

def inat_search(latin,kind):
 """Research-grade observations; per-MEDIA license must permit redistribution."""
 if deadline_reached():return []
 with INAT_LOCK:
  remaining=INAT_NEXT[0]-time.monotonic()
  if remaining>0:time.sleep(remaining)
  INAT_NEXT[0]=time.monotonic()+INAT_GAP
 try:
  params={'taxon_name':latin,'quality_grade':'research','per_page':20,'order':'desc','order_by':'created_at'}
  params['sounds' if kind=='audio' else 'photos']='true'
  r=sess().get(INAT,params=params,timeout=(5,12))
  r.raise_for_status()
  results=r.json().get('results',[])
 except (requests.RequestException,ValueError,AttributeError):
  return []
 candidates=[]
 for obs in results:
  taxon=obs.get('taxon') or {}
  if str(taxon.get('name','')).lower()!=latin.lower():continue
  for item in obs.get('observation_sounds' if kind=='audio' else 'observation_photos',[]):
   media=item.get('sound' if kind=='audio' else 'photo') or {}
   code=media.get('license_code')
   if not allowed_cc(code):continue
   if kind=='image':
    url=media.get('large_url') or media.get('url') or ''
    url=re.sub(r'/(square|thumb|small|medium)\.', '/medium.',url)
    mime='image/png' if url.lower().split('?',1)[0].endswith('.png') else 'image/jpeg'
   else:
    url=media.get('file_url') or media.get('url') or ''
    pathname=urlparse(url).path.lower()
    mime='audio/mpeg' if pathname.endswith('.mp3') else 'audio/ogg' if pathname.endswith(('.ogg','.oga')) else 'audio/wav' if pathname.endswith('.wav') else None
   if not mime or not str(url).startswith('https://'):continue
   source='https://www.inaturalist.org/observations/'+str(obs.get('id'))
   credit={'author':str(media.get('attribution') or (obs.get('user') or {}).get('login') or 'iNaturalist contributor'),'license':str(code).upper(),'source':source,'licenseUrl':str(media.get('license_url') or 'https://creativecommons.org/licenses/')}
   candidates.append((url,credit,mime))
   if len(candidates)>=7:return candidates
 return candidates

def xeno_audio(latin):
 """Optional xeno-canto API v3 source; requires user-owned API key in GitHub Secrets."""
 if not XENO_KEY or deadline_reached():return []
 genus,species=latin.split(' ',1)
 try:
  r=sess().get(XENO,params={'query':'gen:'+genus+' sp:'+species,'key':XENO_KEY},timeout=(5,12))
  r.raise_for_status()
  recs=r.json().get('recordings',[])
 except (requests.RequestException,ValueError,AttributeError):
  return []
 matches=[]
 for rec in recs:
  if str(rec.get('gen','')).lower()!=genus.lower() or str(rec.get('sp','')).lower()!=species.lower():continue
  quality=str(rec.get('q','')).upper()
  if quality not in ('A','B','C'):continue
  license_url=str(rec.get('lic') or '')
  if license_url.startswith('//'):license_url='https:'+license_url
  lower=license_url.lower()
  if not (('/by/' in lower or '/by-sa/' in lower or '/zero/' in lower) and '/by-nc' not in lower and '/by-nd' not in lower):continue
  url=str(rec.get('file') or '')
  if url.startswith('//'):url='https:'+url
  if not url.startswith('https://'):continue
  # v3 file link is the direct downloaded recording, often MP3
  mime='audio/ogg' if urlparse(url).path.lower().endswith(('.ogg','.oga')) else 'audio/mpeg'
  credit={'author':str(rec.get('rec') or 'xeno-canto contributor'),'license':license_url,'source':'https://xeno-canto.org/'+str(rec.get('id')),'licenseUrl':license_url}
  matches.append(({'A':0,'B':1,'C':2}[quality],url,credit,mime))
 return [(url,credit,mime) for _,url,credit,mime in sorted(matches,key=lambda x:x[0])[:6]]

def english_page_photo(latin):
 r=query(ENWIKI,{'titles':latin,'redirects':'1','prop':'extracts|pageimages','explaintext':'1','piprop':'name','pithumbsize':'780'})
 p=next(iter(r.get('pages',[])),{})
 if not p or p.get('missing') or not p.get('pageimage'):return None
 extract=str(p.get('extract') or '')
 # Prevent an image from a coincidentally named or redirected non-target page
 if latin.lower()!=str(p.get('title','')).lower() and latin.lower() not in extract[:1800].lower():return None
 return photo_from_wikipedia({'latin':latin},p['pageimage'])

def valid_existing_media(b,field):
 relative=b.get(field)
 if not isinstance(relative,str) or not relative.startswith('media/'):return False
 path=(APP/relative).resolve()
 try:path.relative_to(M.resolve())
 except ValueError:return False
 return path.is_file() and path.stat().st_size>=250

def restore_existing():
 path=APP/'data.js'
 if not path.is_file():return {}
 try:
  raw=path.read_text(encoding='utf8').strip()
  if not raw.startswith('window.BIRDS_DATA='):return {}
  entries=json.loads(raw[len('window.BIRDS_DATA='):].rstrip(';'))
  return {b['latin']:b for b in entries if isinstance(b,dict) and b.get('latin')}
 except (OSError,ValueError,KeyError):return {}

def download(url,dst,limit):
 if deadline_reached():return False
 try:
  with sess().get(url,stream=True,timeout=(5,16)) as r:
   r.raise_for_status()
   hostname=urlparse(r.url).hostname or ''
   if not (hostname=='upload.wikimedia.org' or hostname.endswith('.wikimedia.org') or hostname in ('static.inaturalist.org','inaturalist-open-data.s3.amazonaws.com','xeno-canto.org','www.xeno-canto.org') or hostname.endswith('.inaturalist.org')):return False
   if int(r.headers.get('Content-Length','0'))>limit:return False
   dst.parent.mkdir(parents=True,exist_ok=True)
   size=0
   with dst.open('wb') as f:
    for block in r.iter_content(65536):
     size+=len(block)
     if size>limit:raise ValueError('too large')
     f.write(block)
   first=dst.open('rb').read(16)
   if size<250:return False
   ext=dst.suffix.lower()
   return (ext=='.jpg' and first.startswith(b'\xff\xd8')) or (ext=='.png' and first.startswith(b'\x89PNG')) or (ext=='.webp' and first.startswith(b'RIFF') and first[8:12]==b'WEBP') or (ext=='.ogg' and first.startswith(b'OggS')) or (ext=='.mp3' and (first.startswith(b'ID3') or first[:1]==b'\xff')) or (ext=='.wav' and first.startswith(b'RIFF'))
 except (ValueError,OSError,requests.RequestException):
  return False
 finally:
  if dst.exists() and dst.stat().st_size<250:dst.unlink(missing_ok=True)
def wiki(b):
 for title in [b['name'],b['latin']]:
  r=query(WIKI,{'titles':title,'redirects':'1','prop':'extracts|pageimages','explaintext':'1','piprop':'name','pithumbsize':'780'})
  p=next(iter(r.get('pages',[])),{})
  if not p or p.get('missing') or not p.get('pageid'):continue
  extract=str(p.get('extract','')).strip()
  if not extract:continue
  # Scientific name or exact Russian page title must identify the intended taxon.
  if b['latin'].lower() not in extract[:1600].lower() and b['name'].lower()!=p.get('title','').lower():continue
  return p,extract
 return {},''
def photo_choices(b,filename):
 if filename:
  item=photo_from_wikipedia(b,filename)
  if item:yield item
 if deadline_reached():return
 item=english_page_photo(b['latin'])
 if item:yield item
 if deadline_reached():return
 for item in media_search(b['latin'],'image')[:5]:yield item
 if deadline_reached():return
 for item in inat_search(b['latin'],'image')[:7]:yield item

def curated_commons_audio(latin):
 """Use Commons category assigned to the actual taxon, not generic field audio."""
 if deadline_reached():return []
 results=query(COMMONS,{'generator':'categorymembers','gcmtitle':'Category:Audio files of '+latin,'gcmtype':'file','gcmlimit':'100','prop':'imageinfo','iiprop':'url|size|mime|extmetadata'})
 matches=[]
 forbidden=re.compile(r'conversation|talking|interview|speech|human.voice|people.talking|soundscape|sound.cloud|forest.ambien|background.noise|narrat|read.aloud|podcast|radio',re.I)
 for item in results.get('pages',[]):
  title=str(item.get('title',''))
  if forbidden.search(title):continue
  info=(item.get('imageinfo') or [{}])[0]
  mime=str(info.get('mime',''))
  if mime not in ('audio/ogg','application/ogg','audio/mpeg','audio/wav','audio/x-wav'):continue
  if int(info.get('size') or 0)>5_300_000:continue
  credit=lic(info)
  if not credit:continue
  url=info.get('url')
  if not url:continue
  # Full scientific name, species category, or XC field-recording identifier
  name_score=0 if re.search(r'XC\d{3,}',title,re.I) else 1 if latin.lower() in title.lower().replace('_',' ') else 2
  type_score=0 if re.search(r'song|sing|call|voice|gesang|ruf|пени|крик',title,re.I) else 1
  matches.append(((name_score,type_score,int(info.get('size') or 0)),url,credit,mime))
 return [(url,credit,mime) for _,url,credit,mime in sorted(matches,key=lambda x:x[0])[:12]]

def audio_choices(b):
 if deadline_reached():return
 # Species-specific field recordings only: no iNaturalist ambient observation sounds.
 for item in xeno_audio(b['latin'])[:5]:yield item
 if deadline_reached():return
 for item in curated_commons_audio(b['latin'])[:10]:yield item
 if deadline_reached():return
 for item in media_search(b['latin'],'audio')[:6]:yield item

def enrich(b):
 if deadline_reached():return b
 p={}
 if not b.get('articleComplete') or not b.get('description'):
  p,txt=wiki(b)
  if len(txt)>=500:
   b['description']=re.sub(r'\n{3,}','\n\n',txt[:16000])
   b['descriptionSource']='https://ru.wikipedia.org/?curid='+str(p['pageid'])
   b['articleComplete']=True
  elif not b.get('description'):
   b['description']='Полная справочная статья пока не найдена в проверенном открытом источнике.'
   b['descriptionSource']=None
   b['articleComplete']=False
 if not valid_existing_media(b,'imageFile'):
  b['imageFile']=None
  seen=set()
  for url,credit,mime in photo_choices(b,p.get('pageimage')):
   if deadline_reached():break
   if url in seen:continue
   seen.add(url)
   ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}.get(mime)
   if not ext:continue
   dst=M/'image'/(b['id']+'.'+ext)
   if download(url,dst,2_500_000):
    b['imageFile']='media/image/'+dst.name
    b['imageCredits']=credit
    break
   dst.unlink(missing_ok=True)
 current_audio_source=(b.get('audioCredits') or {}).get('source','')
 # Old iNaturalist audio often includes speech/ambience despite Research Grade observation.
 # Never reuse it as a verified standalone bird vocalization.
 if 'inaturalist.org' in current_audio_source:
  old=(APP/b.get('audioFile','')).resolve()
  try:old.relative_to(M.resolve())
  except ValueError:old=None
  if old and old.exists():old.unlink(missing_ok=True)
  b['audioFile']=None
  b['audioCredits']=None
 if not valid_existing_media(b,'audioFile'):
  b['audioFile']=None
  seen=set()
  for url,credit,mime in audio_choices(b):
   if deadline_reached():break
   if url in seen:continue
   seen.add(url)
   ext={'audio/ogg':'ogg','application/ogg':'ogg','audio/mpeg':'mp3','audio/wav':'wav','audio/x-wav':'wav'}.get(mime)
   if not ext:continue
   dst=M/'audio'/(b['id']+'.'+ext)
   if download(url,dst,5_300_000):
    b['audioFile']='media/audio/'+dst.name
    b['audioCredits']=credit
    break
   dst.unlink(missing_ok=True)
 return b

def checkpoint(birds):
 APP.mkdir(exist_ok=True,parents=True)
 (APP/'data.js').write_text('window.BIRDS_DATA='+json.dumps(birds,ensure_ascii=False,separators=(',',':'))+';',encoding='utf8')
 report={'species':len(birds),'photos':sum(bool(b.get('imageFile')) for b in birds),'birdCalls':sum(bool(b.get('audioFile')) for b in birds),'articles':sum(bool(b.get('articleComplete')) for b in birds),'missingPhotos':[b['latin'] for b in birds if not b.get('imageFile')],'missingAudio':[b['latin'] for b in birds if not b.get('audioFile')],'missingArticles':[b['latin'] for b in birds if not b.get('articleComplete')]}
 report['imageSources']={src:sum(bool(b.get('imageFile')) and src in (b.get('imageCredits') or {}).get('source','') for b in birds) for src in ('wikimedia.org','inaturalist.org')}
 report['audioSources']={src:sum(bool(b.get('audioFile')) and src in (b.get('audioCredits') or {}).get('source','') for b in birds) for src in ('wikimedia.org','inaturalist.org','xeno-canto.org')}
 (ROOT/'data'/'coverage.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
 return report

def main():
 global FETCH_DEADLINE
 source=''.join((ROOT/'data'/'species.b64').read_text(encoding='ascii').split())
 lines=zlib.decompress(base64.b64decode(source)).decode('utf8').splitlines()
 prior=restore_existing()
 print('Previous verified entries:',len(prior),flush=True)
 birds=[]
 for row in lines:
  name,latin=row.split('|',1)
  genre=latin.split(' ',1)[0]
  group=next((g for g,genes in GROUPS.items() if genre in genes),'Прочие птицы')
  old=prior.get(latin,{})
  bird={'id':latin.lower().replace(' ','-'),'name':name,'latin':latin,'group':group,'imageFile':None,'audioFile':None,'imageCredits':None,'audioCredits':None,'articleComplete':False}
  for field in ('imageFile','audioFile','imageCredits','audioCredits','articleComplete','description','descriptionSource','descriptionLanguage','descriptionAttribution','descriptionTitle','descriptionStatus'):
   if field in old:bird[field]=old[field]
  birds.append(bird)
 assert len(birds)==298,'Expected exactly 298 species from audited regional source'
 assert len({b['latin'] for b in birds})==298
 # Always create a valid catalog before making ANY network calls.
 for b in birds:
  for media_field in ('imageFile','audioFile'):
   if not valid_existing_media(b,media_field):
    b[media_field]=None
 for bird in birds:
  if 'inaturalist.org' in str((bird.get('audioCredits') or {}).get('source','')):
   bird['audioFile']=None
   bird['audioCredits']=None
 initial=checkpoint(birds)
 budget=max(60,min(2400,int(os.environ.get('BIRDS_FETCH_BUDGET_SECONDS','1800'))))
 FETCH_DEADLINE=time.monotonic()+budget
 print('Catalog:',len(birds),'species; starting licensed-media enrichment with',budget,'seconds budget.',flush=True)
 print('Cached coverage:',{k:initial[k] for k in ('species','photos','birdCalls','articles')},flush=True)
 processed=0
 # Small batches prevent 298 slow queries from being queued and give reliable checkpoints.
 for offset in range(0,len(birds),8):
  if deadline_reached():
   print('Fetch budget reached; moving to EXE build with all verified files.',flush=True)
   break
  with ThreadPoolExecutor(max_workers=4) as executor:
   mapping={executor.submit(enrich,birds[i]):i for i in range(offset,min(offset+8,len(birds)))}
   for fut in as_completed(mapping):
    idx=mapping[fut]
    try:birds[idx]=fut.result()
    except Exception as exc:print('WARN',birds[idx]['latin'],str(exc)[:150],flush=True)
    processed+=1
  report=checkpoint(birds)
  print('PROGRESS',processed,'/',len(birds),'photos',report['photos'],'sounds',report['birdCalls'],'articles',report['articles'],flush=True)
 report=checkpoint(birds)
 print('MEDIA COVERAGE',json.dumps({k:report[k] for k in ('species','photos','birdCalls','articles')}),flush=True)
 if processed<len(birds):print('PARTIAL MEDIA CATALOG: more media can be added in a later build.',flush=True)
 if report['photos']==0 and report['birdCalls']==0:print('WARNING: no permitted media available from sources; actual coverage is zero.',flush=True)

if __name__=='__main__':main()
