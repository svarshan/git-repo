#!/usr/bin/env python3
"""Recover missing voices from additional exact-taxon Commons audio categories.
Never use a different species or an unclear license. Xeno v3 remains optional
via a user-provided XENO_CANTO_API_KEY in GitHub Actions Secrets.
"""
import json,os,time
from pathlib import Path
import harvest_voices as v
from make_catalog import APP,ROOT,M,valid_existing_media
DATA=APP/'data.js'; REPORT=ROOT/'data'/'coverage.json'
def main():
 raw=DATA.read_text('utf8').strip()
 if not raw.startswith('window.BIRDS_DATA='):raise ValueError('Missing offline catalog')
 birds=json.loads(raw[len('window.BIRDS_DATA='):].rstrip(';'))
 if len(birds)!=298:raise ValueError('Expected 298 species')
 v.STOP=time.monotonic()+max(60,min(1200,int(os.getenv('BIRDS_VOICES82_BUDGET_SECONDS','540'))))
 missing=[b for b in birds if not valid_existing_media(b,'audioFile')]
 print('VOICES 8.2: additional exact-species Commons category search for',len(missing),'species',flush=True)
 added=[]
 for b in missing:
  if time.monotonic()>=v.STOP:break
  names=list(dict.fromkeys([b['latin']]+v.SYNONYMS.get(b['latin'],[])))
  candidates=[]
  for name in names[:3]:
   for title in ('Sounds of '+name,'Bird calls of '+name,'Bird sounds of '+name,
                 'Bird songs of '+name,'Songs of '+name,'Audio files of '+name):
    if time.monotonic()>=v.STOP:break
    candidates.extend(v.category(title,names,True))
   if candidates:break
  seen=set()
  for url,credit,mime in candidates:
   if url in seen or time.monotonic()>=v.STOP:continue
   seen.add(url)
   ext=v.AUDIO[mime]
   dest=M/'audio'/(b['id']+'-82.'+ext)
   if v.download(url,dest,8_000_000):
    b['audioFile']='media/audio/'+dest.name
    credit['audioReview']='taxon and license metadata verified, no listening certification'
    b['audioCredits']=credit
    added.append({'latin':b['latin'],'source':credit['source'],'license':credit['license']})
    break
   dest.unlink(missing_ok=True)
  v.save(birds)
 (ROOT/'data'/'voices82-added.json').write_text(json.dumps(added,ensure_ascii=False,indent=2),encoding='utf8')
 print('VOICES 8.2 extra sources',len(added),'remaining',sum(not valid_existing_media(b,'audioFile') for b in birds),flush=True)
if __name__=='__main__':main()
