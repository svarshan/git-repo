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
thread=threading.local()
UA=os.environ.get('BIRDS_USER_AGENT','MoOLVa Birds NN/2.0 (educational desktop encyclopedia; github.com/svarshan/git-repo)')
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
 for tries in range(3):
  try:
   r=sess().get(url,params=args,timeout=20)
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
 q=query(COMMONS,{'generator':'search','gsrsearch':'"'+latin+'"','gsrnamespace':'6','gsrlimit':'25','prop':'imageinfo','iiprop':'url|size|mime|extmetadata','iiurlwidth':'780'})
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
def download(url,dst,limit):
 try:
  with sess().get(url,stream=True,timeout=(10,35)) as r:
   r.raise_for_status()
   hostname=urlparse(r.url).hostname or ''
   if not (hostname=='upload.wikimedia.org' or hostname.endswith('.wikimedia.org')):return False
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
  r=query(WIKI,{'titles':title,'redirects':'1','prop':'extracts|pageimages','explaintext':'1','exintro':'1','piprop':'name','pithumbsize':'780'})
  p=next(iter(r.get('pages',[])),{})
  if not p or p.get('missing') or not p.get('pageid'):continue
  extract=str(p.get('extract','')).strip()
  if not extract:continue
  # Scientific name or exact Russian page title must identify the intended taxon.
  if b['latin'].lower() not in extract[:1600].lower() and b['name'].lower()!=p.get('title','').lower():continue
  return p,extract
 return {},''
def enrich(b):
 p,txt=wiki(b)
 if len(txt)>=280:
  b['description']=re.sub(r'\n{3,}','\n\n',txt[:8000])
  b['descriptionSource']='https://ru.wikipedia.org/?curid='+str(p['pageid'])
  b['articleComplete']=True
 else:
  b['description']='Полная справочная статья пока не найдена в проверенном открытом источнике.'
  b['descriptionSource']=None
  b['articleComplete']=False
 filename=p.get('pageimage')
 candidates=[]
 if filename:
  fromwiki=photo_from_wikipedia(b,filename)
  if fromwiki:candidates.append(fromwiki)
 candidates+=media_search(b['latin'],'image')
 for url,credit,mime in candidates[:6]:
  ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[mime]
  dst=M/'image'/(b['id']+'.'+ext)
  if download(url,dst,2_500_000):
   b['imageFile']='media/image/'+dst.name;b['imageCredits']=credit;break
  dst.unlink(missing_ok=True)
 for url,credit,mime in media_search(b['latin'],'audio')[:5]:
  ext={'audio/ogg':'ogg','application/ogg':'ogg','audio/mpeg':'mp3','audio/wav':'wav','audio/x-wav':'wav'}[mime]
  dst=M/'audio'/(b['id']+'.'+ext)
  if download(url,dst,5_300_000):
   b['audioFile']='media/audio/'+dst.name;b['audioCredits']=credit;break
  dst.unlink(missing_ok=True)
 return b
def main():
 source=''.join((ROOT/'data'/'species.b64').read_text(encoding='ascii').split())
 lines=zlib.decompress(base64.b64decode(source)).decode('utf8').splitlines()
 birds=[]
 for row in lines:
  name,latin=row.split('|',1)
  genre=latin.split(' ',1)[0]
  group=next((g for g,genes in GROUPS.items() if genre in genes),'Прочие птицы')
  birds.append({'id':latin.lower().replace(' ','-'),'name':name,'latin':latin,'group':group,'imageFile':None,'audioFile':None,'imageCredits':None,'audioCredits':None,'articleComplete':False})
 assert len(birds)==298,'Expected exactly 298 species from audited regional source'
 assert len({b['latin'] for b in birds})==298
 print('Catalog:',len(birds),'species. Downloading articles / licensed images / authentic bird calls...',flush=True)
 result=[None]*len(birds)
 with ThreadPoolExecutor(max_workers=4) as executor:
  mapping={executor.submit(enrich,b):i for i,b in enumerate(birds)}
  for n,fut in enumerate(as_completed(mapping),1):
   idx=mapping[fut]
   try: result[idx]=fut.result()
   except Exception as exc:result[idx]=birds[idx];print('WARN',birds[idx]['latin'],str(exc)[:100],flush=True)
   if n%15==0:print('Enriched',n,'/',len(birds),flush=True)
 birds=result
 APP.mkdir(exist_ok=True,parents=True)
 (APP/'data.js').write_text('window.BIRDS_DATA='+json.dumps(birds,ensure_ascii=False,separators=(',',':'))+';',encoding='utf8')
 report={'species':len(birds),'photos':sum(bool(b.get('imageFile')) for b in birds),'birdCalls':sum(bool(b.get('audioFile')) for b in birds),'articles':sum(bool(b.get('articleComplete')) for b in birds),'missingPhotos':[b['latin'] for b in birds if not b.get('imageFile')],'missingAudio':[b['latin'] for b in birds if not b.get('audioFile')],'missingArticles':[b['latin'] for b in birds if not b.get('articleComplete')]}
 (ROOT/'data'/'coverage.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
 print('MEDIA COVERAGE',json.dumps({k:report[k] for k in ('species','photos','birdCalls','articles')}),flush=True)
 if report['photos']==0 and report['birdCalls']==0:print('WARNING: Wikimedia availability restricted or no qualified results. Report states real counts.',flush=True)
if __name__=='__main__':main()
