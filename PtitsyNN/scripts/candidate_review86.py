#!/usr/bin/env python3
"""List exact-taxon sound candidates for a human reviewer; NEVER attach to the bird catalog."""
import csv
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
ALLOWED={'cc0','cc-by','cc-by-sa'}
def generate(catalog,candidates):
    by_taxon={str(x.get('latin','')).casefold():x for x in candidates.get('results',[])}
    rows=[]
    for bird in catalog:
        if bird.get('audioFile'):
            continue
        taxon=str(bird.get('latin',''))
        group=by_taxon.get(taxon.casefold()) or {}
        valid=[]
        for c in group.get('candidates',[]):
            if (str(c.get('license','')).casefold() not in ALLOWED or
                not str(c.get('download_url','')).startswith('https://') or not str(c.get('author','')).strip() or
                not str(c.get('observation','')).startswith('https://www.inaturalist.org/observations/')):
                continue
            valid.append(c)
        status='candidate-needs-human-review' if valid else ('search-error' if group.get('status')=='search_error' else 'not-found-in-current-search')
        if not valid:
            rows.append({'latin':taxon,'name':bird.get('name',''),'status':status,'candidate_url':'','license':'','author':''})
        for c in valid:
            rows.append({'latin':taxon,'name':bird.get('name',''),'status':status,'candidate_url':c['observation'],'license':c['license'],'author':c['author']})
    return rows
def main():
    data=json.loads((ROOT/'app'/'data.js').read_text(encoding='utf-8-sig').split('window.BIRDS_DATA=',1)[1].rstrip(';\n '))
    path=ROOT/'dist'/'release-evidence'/'voice-candidates85.json'
    if not path.exists():raise FileNotFoundError('Original 8.5 candidate search report missing: refusing fabricated inventory')
    rows=generate(data,json.loads(path.read_text(encoding='utf-8')))
    out=ROOT/'dist'/'release-evidence';out.mkdir(parents=True,exist_ok=True)
    fields=['latin','name','status','candidate_url','license','author']
    with (out/'candidate-review86.csv').open('w',encoding='utf-8-sig',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=fields,delimiter=';');writer.writeheader()
        for row in rows:
            writer.writerow({k:("'"+v if isinstance(v,str) and v.startswith(('=','+','-','@','\t')) else v) for k,v in row.items()})
    report={'speciesWithoutPrimaryVoice':sum(not b.get('audioFile') for b in data),'candidateRows':sum(x['status']=='candidate-needs-human-review' for x in rows),
      'scope':'Licensed metadata candidates ONLY; no audio file added, no identity verified, no human listening performed','rows':rows}
    (out/'candidate-review86.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print('8.6 CANDIDATE AUDIT',report['speciesWithoutPrimaryVoice'],report['candidateRows'],flush=True)
if __name__=='__main__':main()
