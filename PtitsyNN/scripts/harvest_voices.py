#!/usr/bin/env python3
"""Find taxon-specific, reusable bird calls worldwide, offline for Windows EXE.

Primary source: Wikimedia Commons species audio categories, recordings of birds
from Russia, and CC-licensed British Library sound files mirrored at Commons.
Optional xeno-canto v3 API is handled in make_catalog.py when user's key exists.

Never download a recording from a random website merely because it is free to
listen to. Attribution/license are recorded on each individual bird.
"""
from concurrent.futures import ThreadPoolExecutor,as_completed
import json,os,re,time,threading
from pathlib import Path
from urllib.parse import urlparse
from make_catalog import APP, ROOT, M, COMMONS, sess, lic, download, valid_existing_media
from make_catalog import query as shared_query

DATA=APP/'data.js'
REPORT=ROOT/'data'/'coverage.json'
STOP=float('inf')
LOCK=threading.Lock()
NEXT=[0.0]
USED=set()
# Taxonomic name changes are checked against historically documented synonyms.
# This list deliberately does not merge two biological species.
SYNONYMS={
 'Chloris chloris':['Carduelis chloris'],
 'Chroicocephalus ridibundus':['Larus ridibundus'],
 'Spinus spinus':['Carduelis spinus'],
 'Acanthis flammea':['Carduelis flammea'],
 'Linaria cannabina':['Carduelis cannabina'],
 'Cyanistes caeruleus':['Parus caeruleus'],
 'Poecile montanus':['Parus montanus'],
 'Poecile palustris':['Parus palustris'],
 'Periparus ater':['Parus ater'],
 'Dendrocopos major':['Picoides major'],
 'Dendrocopos minor':['Dryobates minor'],
 'Dryobates minor':['Dendrocopos minor'],
 'Iduna caligata':['Hippolais caligata'],
 'Clanga clanga':['Aquila clanga'],
 'Clanga pomarina':['Aquila pomarina'],
 'Ardea alba':['Egretta alba','Casmerodius albus'],
 'Falco rusticolus':['Hierofalco rusticolus'],
 'Bubo scandiacus':['Nyctea scandiaca'],
 'Anas crecca':['Nettion crecca'],
 'Spatula clypeata':['Anas clypeata'],
 'Mareca penelope':['Anas penelope'],
 'Spatula querquedula':['Anas querquedula'],
 'Aythya marila':['Fuligula marila'],
 'Chlidonias hybrida':['Sterna hybrida'],
 'Sternula albifrons':['Sterna albifrons'],
 'Ichthyaetus melanocephalus':['Larus melanocephalus'],
 'Larus canus':['Larus canus'],
 'Hydrocoloeus minutus':['Larus minutus'],
 'Curruca communis':['Sylvia communis'],
 'Curruca curruca':['Sylvia curruca'],
 'Curruca nisoria':['Sylvia nisoria'],
 'Fringilla montifringilla':['Fringilla montifringilla'],
}
BAD_TITLE=re.compile(r'(?:iNaturalist observation|conversation|interview|speech|narrat|talking|music|instrumental|soundscape|white noise|bird imitation|imitat|background chatter|voice.?over|radio programme|ambient landscape|forest ambience|multiple species|several species|mixed birds|choir|dawn chorus)',re.I)
POSITIVE=re.compile(r'(?:\bXC\d{4,}\b|\bsong\b|\bsinging\b|\bcall\b|\balarm\b|\bvocal|\bbirdsong\b|gesang|ruf|песня|пение|голос|крик|зов)',re.I)
AUDIO={'audio/ogg':'ogg','application/ogg':'ogg','audio/mpeg':'mp3','audio/wav':'wav','audio/x-wav':'wav'}
INDEX={}
def myquery(params):
 if time.monotonic()>=STOP:return {}
 with LOCK:
  pause=NEXT[0]-time.monotonic()
  if pause>0:time.sleep(pause)
  NEXT[0]=time.monotonic()+0.27
 return shared_query(COMMONS,params)
def match_scientific(text,names):
 text=str(text or '').lower().replace('_',' ').replace('–','-')
 return any(re.search(r'(?<![a-z])'+re.escape(n.lower()).replace(r'\ ',r'[\s_.-]+')+r'(?![a-z])',text) for n in names)
def candidates_from_pages(pages,names,exact_category=False):
 found=[]
 for p in pages:
  title=str(p.get('title',''))
  if BAD_TITLE.search(title):continue
  # Category membership provides an exact species match, or require an explicit Latin name.
  if not exact_category and not match_scientific(title,names):continue
  info=(p.get('imageinfo') or [{}])[0]
  mime=str(info.get('mime',''))
  if mime not in AUDIO:continue
  size=int(info.get('size') or 0)
  if size<250 or size>8_000_000:continue
  cr=lic(info)
  if not cr:continue
  source=str(cr.get('source') or '')
  if not source.startswith('https://commons.wikimedia.org/'):continue
  url=info.get('url')
  if not url or not str(url).startswith('https://'):continue
  # Titles with a proven Latin identity rank first; strong song/call titles beat generic recordings.
  score=(0 if match_scientific(title,names) else 1,
         0 if POSITIVE.search(title) else 1,
         0 if re.search(r'\bXC\d{4,}\b',title,re.I) else 1,
         abs(size-320_000))
  cr['speciesMatch']='scientific name in file title' if score[0]==0 else 'Commons species audio category'
  cr['audioReview']='recording and free license sourced; no individual listening audit'
  found.append((score,url,cr,mime))
 found.sort(key=lambda c:c[0])
 return [(url,credit,mime) for _,url,credit,mime in found]
def category(name,names,strict=True):
 q=myquery({'generator':'categorymembers','gcmtitle':'Category:'+name,
  'gcmtype':'file','gcmlimit':'100','prop':'imageinfo',
  'iiprop':'url|size|mime|extmetadata'})
 return candidates_from_pages(q.get('pages',[]),names,exact_category=strict)
def direct_file_titles(names):
 titles=['File:'+name+'.ogg' for name in names]
 titles+=['File:'+name+' song.ogg' for name in names]
 q=myquery({'titles':'|'.join(titles[:40]),'prop':'imageinfo',
  'iiprop':'url|size|mime|extmetadata'})
 return candidates_from_pages(q.get('pages',[]),names)
def filename_search(name,names):
 q=myquery({'generator':'search','gsrsearch':'"'+name+'"','gsrnamespace':'6','gsrlimit':'75',
  'prop':'imageinfo','iiprop':'url|size|mime|extmetadata'})
 return candidates_from_pages(q.get('pages',[]),names)
def collection_index():
 # Global Wikimedia Commons categories: real recordings from Russia + British Library.
 # Indexed by exact Latin binomial, not by ambiguous colloquial name.
 total=0
 for collection in ['Sounds of birds recorded in Russia','Wildlife Sounds in the British Library']:
  continuation={}
  for page in range(3):
   if time.monotonic()>=STOP:break
   params={'generator':'categorymembers','gcmtitle':'Category:'+collection,
     'gcmtype':'file','gcmlimit':'150','prop':'imageinfo','iiprop':'url|size|mime|extmetadata'}
   params.update(continuation)
   q=myquery(params)
   pages=q.get('pages',[])
   INDEX.setdefault(collection,[]).extend(pages)
   total+=len(pages)
   continuation=q.get('continue',{})
   if not continuation:break
 print('GLOBAL BIRD SOUND INDEX',total,'Commons records (Russia/British Library)',flush=True)
def find(b):
 if time.monotonic()>=STOP:return b,False
 if valid_existing_media(b,'audioFile') and 'inaturalist.org' not in str((b.get('audioCredits') or {}).get('source','')):
  return b,False
 names=list(dict.fromkeys([b['latin']]+SYNONYMS.get(b['latin'],[])))
 groups=[]
 # Exact taxon category is particularly reliable: a file need not have Latin words in its name.
 for name in names[:3]:
  groups.extend(category('Audio files of '+name,names,True))
  if not groups:groups.extend(category('Bird sounds of '+name,names,True))
  if not groups:groups.extend(category(name+' songs',names,True))
  if time.monotonic()>=STOP:break
 if not groups:
  for files in INDEX.values():
   groups.extend(candidates_from_pages(files,names,False))
 if not groups:groups.extend(direct_file_titles(names))
 if not groups:
  for name in names[:2]:
   groups.extend(filename_search(name,names))
   if groups:break
 seen=set()
 for url,cr,mime in groups:
  if time.monotonic()>=STOP:break
  if url in seen:continue
  seen.add(url)
  dest=M/'audio'/(b['id']+'.'+AUDIO[mime])
  if download(url,dest,8_000_000):
   b['audioFile']='media/audio/'+dest.name
   b['audioCredits']=cr
   return b,True
  dest.unlink(missing_ok=True)
 return b,False
def save(birds):
 DATA.write_text('window.BIRDS_DATA='+json.dumps(birds,ensure_ascii=False,separators=(',',':'))+';',encoding='utf8')
 r=json.loads(REPORT.read_text(encoding='utf8')) if REPORT.exists() else {}
 r['birdCalls']=sum(bool(b.get('audioFile')) for b in birds)
 r['missingAudio']=[b['latin'] for b in birds if not b.get('audioFile')]
 r['audioSources']={source:sum(bool(b.get('audioFile')) and source in (b.get('audioCredits') or {}).get('source','')
  for b in birds) for source in ('wikimedia.org','inaturalist.org','xeno-canto.org')}
 REPORT.write_text(json.dumps(r,ensure_ascii=False,indent=2),encoding='utf8')
 return r
def main():
 global STOP
 raw=DATA.read_text(encoding='utf8').strip()
 if not raw.startswith('window.BIRDS_DATA='):raise RuntimeError('No generated catalog')
 birds=json.loads(raw[len('window.BIRDS_DATA='):].rstrip(';'))
 if len(birds)!=298:raise RuntimeError('Expected 298 species')
 budget=max(60,min(2400,int(os.getenv('BIRDS_VOICE_BUDGET_SECONDS','1400'))))
 STOP=time.monotonic()+budget
 collection_index()
 pending=[i for i,b in enumerate(birds) if not b.get('audioFile') or
    not valid_existing_media(b,'audioFile')]
 print('WORLD BIRD VOICES',len(pending),'missing',budget,'seconds budget',flush=True)
 attempted=0
 successful=0
 for offset in range(0,len(pending),12):
  if time.monotonic()>=STOP:break
  work=pending[offset:offset+12]
  with ThreadPoolExecutor(max_workers=5) as pool:
   tasks={pool.submit(find,birds[i]):i for i in work}
   for fut in as_completed(tasks):
    j=tasks[fut]
    try:
     b,ok=fut.result()
     birds[j]=b
     if ok:successful+=1
    except Exception as e:print('VOICE WARN',birds[j]['latin'],str(e)[:140],flush=True)
    attempted+=1
  r=save(birds)
  print('VOICE PROGRESS',attempted,'/',len(pending),'new',successful,'total',r['birdCalls'],flush=True)
 r=save(birds)
 print('VOICE COVERAGE FINAL',json.dumps({'species':len(birds),'birdCalls':r['birdCalls'],'missingAudio':len(r['missingAudio']),
  'photos':r.get('photos'),'articles':r.get('articles')},ensure_ascii=False),flush=True)
if __name__=='__main__':main()
