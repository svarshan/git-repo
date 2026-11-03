#!/usr/bin/env python3
"""8.3 media provenance and cross-species duplicate audit; does not claim human verification."""
import csv,hashlib,json,re
from pathlib import Path
from urllib.parse import urlparse,unquote
ROOT=Path(__file__).resolve().parents[1]
APP=ROOT/'app'; OUT=ROOT/'dist'/'release-evidence'
SUSPICIOUS=re.compile(r'(speech|conversation|interview|podcast|narrat|music|human|talking|soundscape|r[eé]cit|разговор|музык|речь)',re.I)
def rows_from_catalog():
 raw=(APP/'data.js').read_text(encoding='utf8').strip()
 if not raw.startswith('window.BIRDS_DATA='):raise RuntimeError('Expected generated 298-species catalog')
 birds=json.loads(raw[len('window.BIRDS_DATA='):].rstrip(';'))
 if len(birds)!=298 or len({b['latin'] for b in birds})!=298:raise RuntimeError('Species cardinality regression')
 return birds
def digest(path):
 h=hashlib.sha256()
 with path.open('rb') as stream:
  for chunk in iter(lambda:stream.read(131072),b''):h.update(chunk)
 return h.hexdigest()
def validate_and_report():
 birds=rows_from_catalog(); seen={'photo':{},'audio':{}}; rows=[]
 for b in birds:
  item={'name':b.get('name',''),'latin':b['latin']}
  flags=[]
  for kind,field,creditkey in [('photo','imageFile','imageCredits'),('audio','audioFile','audioCredits')]:
   file=b.get(field);credit=b.get(creditkey) or {}
   item[kind+'File']=file or '';item[kind+'License']=credit.get('license') or ''
   item[kind+'Source']=credit.get('source') or ''
   item[kind+'HumanReviewed']='NO'
   if not file:
    if kind=='audio':flags.append('voice-not-found')
    else:flags.append('missing-photo')
    continue
   path=(APP/file).resolve()
   if APP.resolve() not in path.parents or not path.is_file():raise RuntimeError('Invalid '+kind+' catalog path for '+b['latin'])
   if not credit.get('source') or not credit.get('license'):flags.append(kind+'-missing-attribution')
   key=digest(path)
   if key in seen[kind] and seen[kind][key]!=b['latin']:
    flags.append(kind+'-same-media-as-'+seen[kind][key])
   else:seen[kind][key]=b['latin']
   title=unquote(urlparse(credit.get('source') or '').path.rsplit('/',1)[-1]).replace('_',' ')
   if kind=='audio' and SUSPICIOUS.search(title):flags.append('possible-human-speech-or-music')
  item['flags']='; '.join(flags);rows.append(item)
 OUT.mkdir(parents=True,exist_ok=True)
 with (OUT/'audio-review83.csv').open('w',newline='',encoding='utf-8-sig') as f:
  w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
 flagged=sum(bool(x['flags']) for x in rows)
 duplicates=sum('same-media-as-' in x['flags'] for x in rows)
 missing=sum('voice-not-found' in x['flags'] for x in rows)
 (OUT/'audio-review83.md').write_text(
  '# MoOLVa 8.3 media check\n\n'
  +f'- Species: {len(birds)}; missing authentic audio: {missing}; flagged rows: {flagged}; cross-species identical file hashes: {duplicates}.\n'
  +'- Actual source URLs, license credits and SHA256 file equality were checked offline.\n'
  +'- Identical hashes and title keywords are review leads, not proof of a wrong bird.\n'
  +'- Automated checks do not identify human speech or confirm species identity. Human-verified count: 0 (until explicitly audited).\n',
  encoding='utf8')
 print('MEDIA83 AUDIT',json.dumps({'species':len(birds),'withoutVoice':missing,'flagged':flagged,'duplicates':duplicates,'humanVerified':0}),flush=True)
if __name__=='__main__':validate_and_report()
