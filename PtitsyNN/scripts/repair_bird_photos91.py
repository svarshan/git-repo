#!/usr/bin/env python3
"""Install visually reviewed and licensed photographs without touching audio."""
import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'data' / 'approved-bird-photos'
MANIFEST = ASSETS / 'manifest.json'

def apply_photos(birds, entries, assets, app):
    by_name = {b['latin']: b for b in birds}
    if len(by_name) != len(birds) or len({e['latin'] for e in entries}) != len(entries):
        raise ValueError('Duplicate species in catalog or photo manifest')
    staged = []
    for item in entries:
        latin = item['latin']
        filename = item['file']
        if latin not in by_name or Path(filename).name != filename or not filename.endswith('.jpg'):
            raise ValueError('Invalid photo or species: ' + latin)
        source = assets / filename
        raw = source.read_bytes()
        if hashlib.sha256(raw).hexdigest() != item['sha256']:
            raise ValueError('Photo hash mismatch: ' + latin)
        if not item.get('author') or not item.get('license') or not item.get('source','').startswith('https://commons.wikimedia.org/wiki/File:'):
            raise ValueError('Photo attribution missing: ' + latin)
        with Image.open(source) as photo:
            photo.load()
            if photo.format != 'JPEG' or min(photo.size) < 160:
                raise ValueError('Invalid photo dimensions or format: ' + latin)
        bird = by_name[latin]
        dest = app / 'media' / 'image' / (bird['id'] + '-visual91.jpg')
        staged.append((bird, item, source, dest))
    report = []
    for bird,item,source,dest in staged:
        dest.parent.mkdir(parents=True,exist_ok=True)
        if not dest.exists() or hashlib.sha256(dest.read_bytes()).hexdigest() != item['sha256']:
            shutil.copyfile(source,dest)
        previous=bird.get('imageFile')
        bird['imageFile'] = 'media/image/' + dest.name
        bird['imageCredits'] = {k:item[k] for k in ('author','license','licenseUrl','source','photoReview')}
        report.append({'latin':bird['latin'],'name':bird['name'],'previous':previous,'image':bird['imageFile'],'sha256':item['sha256'],'source':item['source'],'license':item['license']})
    return report

def main():
    catalog = ROOT / 'app' / 'data.js'
    raw=catalog.read_text(encoding='utf-8-sig').strip()
    prefix='window.BIRDS_DATA='
    if not raw.startswith(prefix):
        raise ValueError('Catalog missing')
    birds=json.loads(raw[len(prefix):].rstrip(';'))
    entries=json.loads(MANIFEST.read_text(encoding='utf-8'))
    if len(birds)!=298 or len(entries)!=12:
        raise ValueError('Unexpected catalog or reviewed photo count')
    report=apply_photos(birds,entries,ASSETS,ROOT/'app')
    catalog.write_text(prefix+json.dumps(birds,ensure_ascii=False,separators=(',',':'))+';',encoding='utf-8')
    out=ROOT/'dist'/'release-evidence'/'photo-repair91.json'
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print('Installed visually reviewed bird photographs:',len(report),flush=True)

if __name__=='__main__':
    main()
