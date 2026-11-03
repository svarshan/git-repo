#!/usr/bin/env python3
"""Prioritize the three authentic sounds recovered in 8.2 but missing in 8.3.
Only exact-species freely licensed recordings. Never create synthesized replacements.
"""
import csv,json,os,time,hashlib
from audit_audio import inspect as inspect_sound
from pathlib import Path
import voice_max as vx
import harvest_voices as hv
from make_catalog import APP,ROOT,M,valid_existing_media
TARGETS=('Asio otus','Otis tarda','Pica pica')
DATA=APP/'data.js';REPORT=ROOT/'data'/'coverage.json'
def load():
 raw=DATA.read_text('utf8').strip()
 if not raw.startswith('window.BIRDS_DATA='):raise RuntimeError('Missing catalog')
 birds=json.loads(raw[len('window.BIRDS_DATA='):].rstrip(';'))
 if len(birds)!=298 or len({b['latin'] for b in birds})!=298:raise RuntimeError('Species inventory changed')
 return birds
def recover_one(b):
 if valid_existing_media(b,'audioFile'):return 'already-preserved'
 names=list(dict.fromkeys([b['latin']]+hv.SYNONYMS.get(b['latin'],[])))
 candidates=vx.xeno_choices(b)+vx.commons_choices(b)
 # Directly request known scientific-name files on Wikimedia Commons. Generic
 # title searches missed the Pica pica category although Commons has 39 files.
 # The API still determines file URL, license, authorship, size and MIME.
 pinned={
  'Pica pica':[
   'File:Pica pica.ogg',
   'File:Eurasian Magpie (Pica pica) (W1CDR0001537 BD28).ogg',
   'File:Pica pica - Eurasian Magpie XC537413.mp3',
   'File:Pica pica - Eurasian Magpie XC432921.mp3',
   'File:Pica pica - Eurasian Magpie XC475651.mp3'
  ]
 }
 files=pinned.get(b['latin'],[])+['File:'+name+'.ogg' for name in names]
 if files:
  response=hv.myquery({'titles':'|'.join(files[:20]),'prop':'imageinfo',
    'iiprop':'url|size|mime|extmetadata'})
  for url,credit,mime in hv.candidates_from_pages(response.get('pages',[]),names):
   candidates.insert(0,((0,0,0),url,hv.AUDIO[mime],credit))

 # Wikimedia categories are exact scientific taxon, not search results for a common name.
 for name in names[:3]:
  if time.monotonic()>=vx.STOP:break
  for cat in ('Sounds of '+name,'Audio files of '+name,'Bird sounds of '+name,
              'Bird calls of '+name,'Songs of '+name,'Bird songs of '+name):
   if time.monotonic()>=vx.STOP:break
   for url,credit,mime in hv.category(cat,names,True):
    if mime in hv.AUDIO:
     candidates.append(((0,0,0),url,hv.AUDIO[mime],credit))
  if len(candidates)>15:break
 # Exact original Commons files were independently checked for species and rights.
 # Fallback is useful when MediaWiki API search is rate limited or returns no pages.
 # Audit their original SHA-1 to guard against unexpected upstream replacement.
 if b['latin']=='Pica pica':
  originals=[
   ('https://upload.wikimedia.org/wikipedia/commons/f/f6/Eurasian_Magpie_%28Pica_pica%29_%28W1CDR0001537_BD28%29.ogg',
    '452fbbad335ab203b935cd97da9a0a9030f84fa9',
    {'source':'https://commons.wikimedia.org/wiki/File:Eurasian_Magpie_(Pica_pica)_(W1CDR0001537_BD28).ogg',
     'author':'Aubrey John Williams / The British Library Board','license':'CC BY-SA 4.0',
     'licenseUrl':'https://creativecommons.org/licenses/by-sa/4.0/'}),
   ('https://upload.wikimedia.org/wikipedia/commons/b/b6/Pica_pica.ogg',
    'fc5f48e6431ad47f859aaba386bffaa58ba0dcf4',
    {'source':'https://commons.wikimedia.org/wiki/File:Pica_pica.ogg',
     'author':'Oona Räisänen (Mysid)','license':'Public domain',
     'recordingNote':'A House Sparrow is also audible in the background.'})
  ]
  for url,sha1,credit in reversed(originals):
   candidates.insert(0,((0,0,0),url,'ogg',{**credit,'originalSha1':sha1}))
 seen=set()
 for _,url,ext,credit in candidates:
  if time.monotonic()>=vx.STOP:break
  if url in seen:continue
  seen.add(url)
  dest=M/'audio'/(b['id']+'-84.'+ext)
  if vx.download(url,dest):
   if credit.get('originalSha1') and hashlib.sha1(dest.read_bytes()).hexdigest()!=credit['originalSha1']:
    print('RECOVER84 SHA1 mismatch: source bytes changed',b['latin'],flush=True)
    dest.unlink(missing_ok=True)
    continue
   try:inspect_sound(dest)
   except Exception as ex:
    print('RECOVER84 rejected low-quality candidate',b['latin'],str(ex)[:100],flush=True)
    dest.unlink(missing_ok=True)
    continue
   b['audioFile']='media/audio/'+dest.name
   b['audioCredits']={**credit,'audioReview':'species/rights metadata checked; human review pending'}
   return 'found-real-licensed'
  dest.unlink(missing_ok=True)
 return 'not-found'
def main():
 birds=load();vx.STOP=time.monotonic()+max(90,min(1200,int(os.getenv('BIRDS_84_RECOVERY_SECONDS','480'))))
 hv.STOP=vx.STOP
 outcomes=[]
 for taxon in TARGETS:
  b=next((x for x in birds if x['latin']==taxon),None)
  if not b:raise RuntimeError('Historical verified taxon removed: '+taxon)
  status=recover_one(b)
  outcomes.append({'latin':taxon,'result':status,'source':(b.get('audioCredits') or {}).get('source','')})
  hv.save(birds)
  print('RECOVER84',taxon,status,flush=True)
 (ROOT/'data'/'recovery84.json').write_text(json.dumps(outcomes,ensure_ascii=False,indent=2),encoding='utf8')
 print('RECOVER84 finished',sum(valid_existing_media(b,'audioFile') for b in birds),'of 298',flush=True)
if __name__=='__main__':main()
