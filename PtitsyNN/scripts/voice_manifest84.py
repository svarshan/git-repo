#!/usr/bin/env python3
"""SHA256 / per-taxon source manifest, with the remaining missing species enumerated."""
import csv,hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];APP=ROOT/'app'
def main():
 raw=(APP/'data.js').read_text('utf8').strip()
 birds=json.loads(raw[len('window.BIRDS_DATA='):].rstrip(';'))
 if len(birds)!=298:raise RuntimeError('Not 298 species')
 records=[]
 for b in birds:
  rel=b.get('audioFile') or ''
  p=(APP/rel).resolve() if rel else None
  if p is not None and (APP.resolve() not in p.parents or not p.is_file()):raise RuntimeError('Voice file missing on disk: '+b['latin'])
  credit=b.get('audioCredits') or {}
  records.append({'latin':b['latin'],'russian':b.get('name',''),'file':rel,'sha256':hashlib.sha256(p.read_bytes()).hexdigest() if p else '',
    'source':credit.get('source',''),'license':credit.get('license',''),'humanListened':'NO'})
 out=ROOT/'dist'/'release-evidence';out.mkdir(parents=True,exist_ok=True)
 with (out/'voice-sources84.csv').open('w',encoding='utf-8-sig',newline='') as f:
  w=csv.DictWriter(f,fieldnames=list(records[0]));w.writeheader();w.writerows(records)
 result={'goal':298,'available':sum(bool(r['file']) for r in records),'remaining':sum(not r['file'] for r in records),
  'missing':[r['latin'] for r in records if not r['file']], 'sourceManifest':'voice-sources84.csv',
  'notes':'A local audio hash and source license do not replace listening or taxonomy review.'}
 (out/'voice-goal84.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
 print('VOICE MANIFEST84',json.dumps({'available':result['available'],'remaining':result['remaining']},ensure_ascii=False),flush=True)
if __name__=='__main__':main()
