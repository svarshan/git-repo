#!/usr/bin/env python3
"""Fast integrity gate for reusing fully offline prior validated catalog in UI-only releases.
On any error, exits nonzero so the full licensed-media ingestion still runs.
"""
from pathlib import Path
import json,sys
ROOT=Path(__file__).resolve().parents[1]
APP=ROOT/'app';INDEX=APP/'data.js';COVERAGE=ROOT/'data'/'coverage.json'
def main():
 if not INDEX.is_file() or not COVERAGE.is_file():return 2
 text=INDEX.read_text('utf-8').strip()
 if not text.startswith('window.BIRDS_DATA='):return 2
 birds=json.loads(text[len('window.BIRDS_DATA='):].rstrip(';'))
 report=json.loads(COVERAGE.read_text('utf-8'))
 if len(birds)!=298 or len({b.get('latin') for b in birds})!=298:return 2
 totals={'photos':0,'birdCalls':0,'articles':0,'extraAudioTracks':0}
 for bird in birds:
  if bird.get('articleComplete'):totals['articles']+=1
  for field in ('imageFile','audioFile'):
   name=bird.get(field)
   if not name:continue
   path=(APP/name).resolve()
   try:path.relative_to((APP/'media').resolve())
   except ValueError:return 2
   if not path.is_file() or path.stat().st_size<250:return 2
   if not isinstance(bird.get('imageCredits' if field=='imageFile' else 'audioCredits'),dict):return 2
   totals['photos' if field=='imageFile' else 'birdCalls']+=1
  for t in bird.get('audioTracks',[]) or []:
   if not isinstance(t,dict):return 2
   name=t.get('path')
   if not isinstance(name,str) or not name.startswith('media/audio/'):return 2
   path=(APP/name).resolve()
   try:path.relative_to((APP/'media'/'audio').resolve())
   except ValueError:return 2
   if not path.is_file() or path.stat().st_size<3000 or not isinstance(t.get('credit'),dict):return 2
   totals['extraAudioTracks']+=1
 for k,n in totals.items():
  if report.get(k)!=n:return 2
 print('OFFLINE CACHE VERIFIED',json.dumps(totals,ensure_ascii=False),flush=True)
 return 0
if __name__=='__main__':
 try:sys.exit(main())
 except (OSError,ValueError,KeyError,TypeError) as ex:
  print('OFFLINE CACHE REJECTED',ex,flush=True);sys.exit(2)
