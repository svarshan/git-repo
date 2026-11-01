#!/usr/bin/env python3
"""8.2: detect eggs/nest pictures in metadata, replace with licensed real bird photos.
Generate a contact sheet and CSV for REQUIRED visual review; metadata alone cannot
prove what is in a photo. Do not fabricate or substitute images for another taxon.
"""
import csv,json,os,re,time
from pathlib import Path
from urllib.parse import unquote,urlparse
from PIL import Image,ImageDraw,ImageFont,ImageOps
import make_catalog as core

APP=core.APP;ROOT=core.ROOT;MEDIA=core.M
DATA=APP/'data.js'; REPORT=ROOT/'data'/'coverage.json'
OUT=ROOT/'dist'/'release-evidence'/'photo-review'
BAD=re.compile(r'(?<![a-z])(?:eggs?|eggshells?|clutch|nest(?:ing|lings?)?|oeufs?|eiers?|яйц[аоуы]?|кладка|гнезд[оа]?|муляж|illustration|drawing|sketch|diagram|range|distribution|map)(?![a-z])',re.I)
BIRD=re.compile(r'(?<![a-z])(?:bird|birds|adult|male|female|perched|flight|flying|portrait|птица|самец|самка)(?![a-z])',re.I)

def source_title(credit):
 url=str((credit or {}).get('source') or '')
 return unquote(urlparse(url).path.rsplit('/',1)[-1]).replace('_',' ')

def suspicious(credit):
 return bool(BAD.search(source_title(credit)))

def choices(bird):
 # Get only strict scientific species matches and open-license media via curated
 # Wikimedia and iNaturalist integration. Unknown visual content remains flagged.
 yielded=set()
 for item in core.photo_choices(bird,None):
  url,credit,mime=item
  if url in yielded or suspicious(credit):continue
  yielded.add(url)
  yield item

def read():
 raw=DATA.read_text('utf8').strip()
 if not raw.startswith('window.BIRDS_DATA='):raise ValueError('Missing generated catalog')
 birds=json.loads(raw[len('window.BIRDS_DATA='):].rstrip(';'))
 if len(birds)!=298:raise ValueError('Exactly 298 verified species required')
 return birds

def save(birds):
 DATA.write_text('window.BIRDS_DATA='+json.dumps(birds,ensure_ascii=False,separators=(',',':'))+';',encoding='utf8')
 cover=json.loads(REPORT.read_text('utf8'))
 cover['photos']=sum(core.valid_existing_media(b,'imageFile') for b in birds)
 cover['missingPhotos']=[b['latin'] for b in birds if not core.valid_existing_media(b,'imageFile')]
 cover['photo82']={'suspectedEggs':sum(suspicious(b.get('imageCredits')) for b in birds),
    'needsVisualReview':sum(not bool(BIRD.search(source_title(b.get('imageCredits')))) for b in birds)}
 REPORT.write_text(json.dumps(cover,ensure_ascii=False,indent=2),encoding='utf8')

def sheets(birds):
 OUT.mkdir(parents=True,exist_ok=True)
 entries=[]
 for bird in birds:
  credit=bird.get('imageCredits') or {}
  exists=core.valid_existing_media(bird,'imageFile')
  row={'latin':bird['latin'],'name':bird['name'],'image':bird.get('imageFile') or '',
       'source':credit.get('source') or '','author':credit.get('author') or '',
       'license':credit.get('license') or '',
       'metadataProblem':int(suspicious(credit)),
       'decodeError':0,
       'needsHumanVisualReview':int(not BIRD.search(source_title(credit)))}
  entries.append(row)
 for page in range(0,len(birds),60):
  image=Image.new('RGB',(1200,1530),'#e8eff0')
  draw=ImageDraw.Draw(image)
  for idx,bird in enumerate(birds[page:page+60]):
   x=(idx%6)*200;y=(idx//6)*153
   if core.valid_existing_media(bird,'imageFile'):
    try:
     with Image.open(APP/bird['imageFile']) as photo:
      photo=ImageOps.exif_transpose(photo.convert('RGB'))
      if photo.width<160 or photo.height<160:raise ValueError('Low-resolution photograph')
      photo.thumbnail((190,118))
      image.paste(photo,(x+(200-photo.width)//2,y+2))
    except (OSError,ValueError):
     entries[page+idx]['decodeError']=1
     draw.text((x+4,y+30),'BROKEN IMAGE',fill='#9a182a')
   draw.text((x+4,y+120),bird['latin'][:27],fill='#182632')
   if suspicious(bird.get('imageCredits')):draw.text((x+4,y+136),'EGG/NEST SUSPECT',fill='#9a182a')
  image.save(OUT/('contact-%02d.png'%(page//60+1)),optimize=True)
 with (OUT/'photo-review.csv').open('w',encoding='utf-8-sig',newline='') as out:
  w=csv.DictWriter(out,fieldnames=list(entries[0]))
  w.writeheader();w.writerows(entries)
 return entries

def main():
 birds=read()
 old=[b for b in birds if suspicious(b.get('imageCredits')) or not core.valid_existing_media(b,'imageFile')]
 print('PHOTO 8.2 suspect metadata or missing image:',len(old),flush=True)
 core.FETCH_DEADLINE=time.monotonic()+max(45,min(900,int(os.getenv('BIRDS_PHOTO82_BUDGET_SECONDS','360'))))
 replaced=[]
 for bird in old:
  previous=bird.get('imageFile')
  for url,credit,mime in choices(bird):
   if time.monotonic()>=core.FETCH_DEADLINE:break
   ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}.get(mime)
   if not ext:continue
   dest=MEDIA/'image'/(bird['id']+'-82.'+ext)
   if core.download(url,dest,2_500_000):
    bird['imageFile']='media/image/'+dest.name
    bird['imageCredits']={**credit,'photoReview':'metadata-licensed; contact sheet requires manual visual review'}
    replaced.append({'latin':bird['latin'],'previous':previous,'replacement':bird['imageFile'],'source':credit['source']})
    break
   dest.unlink(missing_ok=True)
  save(birds)
 OUT.mkdir(parents=True,exist_ok=True)
 (OUT/'photo-replacements.json').write_text(json.dumps(replaced,ensure_ascii=False,indent=2),encoding='utf8')
 entries=sheets(birds)
 invalid=[r['latin'] for r in entries if r['metadataProblem'] or r['decodeError'] or not r['image']]
 print('PHOTO 8.2 replaced',len(replaced),'invalid',len(invalid),'visual-review',sum(r['needsHumanVisualReview'] for r in entries),flush=True)
 if invalid:raise RuntimeError('Egg/nest or missing photos remain: '+', '.join(invalid))
 print('PHOTO 8.2 META QA PASS. 298 photos must STILL be visually inspected using contact sheets.',flush=True)

if __name__=='__main__':main()
