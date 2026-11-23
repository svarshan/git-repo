#!/usr/bin/env python3
"""Create a per-recording listening queue; automatic audio metrics cannot identify birds or human speech."""
import csv,json,re
from urllib.parse import unquote,urlparse
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'data'/'audio-audit.json'
OUT=ROOT/'dist'/'release-evidence'
SUSPECT=re.compile(r'(?<![a-z])(?:speech|talk|speaking|conversation|interview|people|human|podcast|radio|music|narration|ambient|soundscape|chorus|имитац|разговор|речь|музык)(?![a-z])',re.I)
def main():
 records=json.loads(SRC.read_text('utf8')).get('records',[])
 if not records:raise RuntimeError('No real technical audio audit')
 rows=[]
 for r in records:
  title=unquote(urlparse(str(r.get('source') or '')).path.rsplit('/',1)[-1]).replace('_',' ')
  problems=[]
  if SUSPECT.search(title):problems.append('suspicious-source-title')
  if r.get('result')!='accepted':problems.append('failed-technical-audit')
  if float(r.get('silenceFraction') or 0)>=.55:problems.append('long-silence')
  if r.get('meanDb') is not None and float(r['meanDb'])<-37:problems.append('quiet-audio')
  if r.get('peakDb') is not None and float(r['peakDb'])>-.5:problems.append('possible-clipping')
  if float(r.get('seconds') or 0)<5:problems.append('short-sample')
  rows.append({'latin':r.get('latin'),'name':r.get('bird'),'source':r.get('source'),
      'license':r.get('license'),'fileStatus':r.get('result'),
      'reviewPriority':'high' if problems else 'normal',
      'flags':', '.join(problems),'humanVerified':'NO'})
 OUT.mkdir(parents=True,exist_ok=True)
 with (OUT/'audio-review82.csv').open('w',encoding='utf-8-sig',newline='') as f:
  w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
 pending=sum(bool(r['flags']) for r in rows)
 (OUT/'audio-review82.md').write_text(
  '# MoOLVa audio review 8.2\n\n'+
  f'{len(rows)} recordings passed to manual review; {pending} flagged as higher priority.\n\n'+
  'Technical checks do not certify absence of human speech or correct species. '+
  'Only a human listening audit can mark the species and sound as verified.\n',encoding='utf8')
 print('AUDIO 8.2 LISTENING QUEUE',len(rows),'high-priority',pending,'human-verified 0',flush=True)
if __name__=='__main__':main()
