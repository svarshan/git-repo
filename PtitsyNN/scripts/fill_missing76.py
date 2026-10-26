#!/usr/bin/env python3
"""Fill only MISSING photos and articles using existing strict public-media checks.
Do not replace reviewed recordings, existing photos or complete articles.
No invented content or simulated sources; budgets cap external requests.
"""
import json, os, time
import make_catalog as core
import enrich_articles as wiki
from make_catalog import APP, M, ROOT, valid_existing_media
from pathlib import Path

DATA=APP/'data.js'
REPORT=ROOT/'data'/'coverage.json'

def main():
 raw=DATA.read_text('utf8').strip()
 if not raw.startswith('window.BIRDS_DATA='):raise ValueError('Missing previous catalog')
 birds=json.loads(raw[len('window.BIRDS_DATA='):].rstrip(';'))
 if len(birds)!=298:raise ValueError('Catalog species count changed')
 before_images=sum(valid_existing_media(b,'imageFile') for b in birds)
 before_articles=sum(bool(b.get('articleComplete')) for b in birds)
 budget=max(60,min(700,int(os.getenv('BIRDS_FILL_76_BUDGET_SECONDS','240'))))
 core.FETCH_DEADLINE=wiki.STOP=time.monotonic()+budget
 for b in birds:
  if time.monotonic()>=core.FETCH_DEADLINE:break
  if not valid_existing_media(b,'imageFile'):
   for url,credit,mime in core.photo_choices(b,None):
    if time.monotonic()>=core.FETCH_DEADLINE:break
    ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}.get(mime)
    if not ext:continue
    dest=M/'image'/(b['id']+'-76.'+ext)
    if core.download(url,dest,2_500_000):
     b['imageFile']='media/image/'+dest.name
     b['imageCredits']=credit
     break
    dest.unlink(missing_ok=True)
  if not b.get('articleComplete') and time.monotonic()<core.FETCH_DEADLINE:
   try:
    updated=wiki.fetch(dict(b))
    if updated.get('articleComplete') and updated.get('descriptionSource') and updated.get('descriptionAttribution'):
     for key in ('description','descriptionSource','descriptionLanguage','descriptionTitle','descriptionAttribution','descriptionStatus','articleComplete'):
      if key in updated:b[key]=updated[key]
   except Exception as error:print('ARTICLE 76 REJECT',b.get('latin'),str(error)[:80],flush=True)
  DATA.write_text('window.BIRDS_DATA='+json.dumps(birds,ensure_ascii=False,separators=(',',':'))+';',encoding='utf8')
 report=json.loads(REPORT.read_text('utf8'))
 report['photos']=sum(valid_existing_media(b,'imageFile') for b in birds)
 report['articles']=sum(bool(b.get('articleComplete')) for b in birds)
 report['missingPhotos']=[b['latin'] for b in birds if not valid_existing_media(b,'imageFile')]
 report['missingArticles']=[b['latin'] for b in birds if not b.get('articleComplete')]
 report['fill76']={'photosBefore':before_images,'photosAfter':report['photos'],'articlesBefore':before_articles,'articlesAfter':report['articles'],
  'note':'Only licensed and taxon-matched real images and verified complete text; no placeholders.'}
 REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
 if report['photos']<before_images or report['articles']<before_articles:raise RuntimeError('Media completeness regression')
 print('FILL 76 FINAL',json.dumps(report['fill76'],ensure_ascii=False),flush=True)

if __name__=='__main__':main()
