#!/usr/bin/env python3
"""Protect both v7.9 proven sounds and the three species recovered in successful 8.2.
A missing voice blocks 8.4 release rather than being silently replaced or claimed present.
"""
import json,sys
from pathlib import Path
BASE=Path(__file__).resolve().parents[1]
IMMUTABLE=('Asio otus','Otis tarda','Pica pica')
MINIMUM=264
def check_report(report):
 if int(report.get('species',0))!=298 or int(report.get('photos',0))!=298 or int(report.get('articles',0))!=298:
  raise RuntimeError('Regression: species, photos or articles lost')
 count=int(report.get('birdCalls',0));missing=set(report.get('missingAudio',[]))
 if len(missing)!=298-count:raise RuntimeError('Inconsistent exact-taxon voice inventory')
 lost=[s for s in IMMUTABLE if s in missing]
 if count<MINIMUM or lost:raise RuntimeError(
  '8.4 release blocked: '+str(count)+'/298 authentic calls; minimum '+str(MINIMUM)+
  ', historical 8.2 voices missing: '+', '.join(lost))
 return {'target':298,'verifiedPresent':count,'remaining':298-count,'minimumLocked':MINIMUM,
         'preservedHistorical82':list(IMMUTABLE),'humanListened':False}
def main():
 report=json.loads((BASE/'data'/'coverage.json').read_text(encoding='utf8'))
 summary=check_report(report)
 out=BASE/'dist'/'release-evidence';out.mkdir(parents=True,exist_ok=True)
 (out/'voice-goal84.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf8')
 print('VOICE 8.4 NONREGRESSION',json.dumps(summary,ensure_ascii=False),flush=True)
if __name__=='__main__':
 try:main()
 except Exception as ex:print('VOICE 8.4 GATE FAILED:',ex,file=sys.stderr,flush=True);sys.exit(1)
