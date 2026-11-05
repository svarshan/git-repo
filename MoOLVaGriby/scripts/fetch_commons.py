#!/usr/bin/env python3
"""Fetch real Commons photos for an offline atlas; do not claim visual species verification."""
from __future__ import annotations
import concurrent.futures
import html
import json
import os
import re
import time
from pathlib import Path
from urllib.parse import quote

import requests
from PIL import Image, ImageOps

ROOT=Path(__file__).resolve().parents[1]
MEDIA=ROOT/'media'/'photos'
API='https://commons.wikimedia.org/w/api.php'
HEADERS={'User-Agent':'MoOLVaGriby/1.0 (educational open-media attribution; github.com/svarshan/git-repo)'}
BLOCKED=('microscop','spore','spores','illustrat','drawing','diagram','poster','book','painting','plate','section','cutaway','logo','icon','recipe','cooked','dish','herbarium','map of','stamp','coin')
ALLOWED=('CC BY','CC-BY','CC0','PUBLIC DOMAIN','PD-','PDM')
START=time.monotonic()

def field(x,name):
    return html.unescape(re.sub(r'<[^>]*>','',str(x.get(name,{}).get('value','')))).strip()[:220]

def license_ok(value):
    value=(value or '').upper().replace('_',' ')
    return any(value.startswith(x) for x in ALLOWED) and not any(x in value for x in ('NC','ND','NON-COMMERCIAL','NO DERIVATIVES'))

def photo_candidate(title,latin):
    low=title.lower().replace('_',' ')
    if any(bad in low for bad in BLOCKED):return False
    genus,species=latin.lower().split()[:2]
    pattern=r'\b'+re.escape(genus)+r'[\s_.-]+'+re.escape(species)+r'\b'
    return bool(re.search(pattern,low))

def acquire(species,deadline):
    latin=species['latin']
    folder=MEDIA
    target=folder/(latin.replace(' ','_')+'.jpg')
    if time.monotonic()>deadline:
        return latin,None,'deadline'
    try:
        params={'action':'query','format':'json','generator':'categorymembers',
          'gcmtitle':'Category:'+latin,'gcmtype':'file','gcmlimit':'28',
          'prop':'imageinfo','iiprop':'url|extmetadata','iiurlwidth':'740'}
        data=requests.get(API,params=params,headers=HEADERS,timeout=14).json()
        pages=list((data.get('query') or {}).get('pages',{}).values())
        candidates=[]
        for page in pages:
            title=page.get('title','')
            if not photo_candidate(title,latin):continue
            info=(page.get('imageinfo') or [{}])[0]
            thumb=info.get('thumburl') or ''
            if not thumb.startswith('https://upload.wikimedia.org/'):continue
            ext=info.get('extmetadata') or {}
            rights=field(ext,'LicenseShortName')
            if not license_ok(rights):continue
            artist=field(ext,'Artist') or field(ext,'Attribution') or 'Wikimedia Commons uploader'
            url='https://commons.wikimedia.org/wiki/'+quote(title.replace(' ','_'),safe=':/()_-')
            candidates.append((title,thumb,rights,artist,url))
        for title,thumb,rights,artist,url in candidates[:4]:
            if time.monotonic()>deadline:break
            response=requests.get(thumb,headers=HEADERS,timeout=14)
            if response.status_code!=200 or len(response.content)>3_000_000:continue
            from io import BytesIO
            with Image.open(BytesIO(response.content)) as raw:
                picture=ImageOps.exif_transpose(raw)
                if min(picture.size)<190:continue
                picture=picture.convert('RGB')
                picture.thumbnail((740,600))
                folder.mkdir(parents=True,exist_ok=True)
                picture.save(target,quality=84,optimize=True)
            return latin,{'file':'media/photos/'+target.name,
                'source':url,'author':artist,'license':rights,
                'review':'metadata-only; photographic taxon requires human review'},None
        return latin,None,'no suitable licensed taxon-named photo'
    except (requests.RequestException,ValueError,OSError,KeyError) as exc:
        return latin,None,str(exc)[:160]

def main():
    text=(ROOT/'catalog.js').read_text(encoding='utf8').strip()
    prefix='window.MOOLVA_MUSHROOMS='
    if not text.startswith(prefix):raise ValueError('Invalid fungi catalog')
    species=json.loads(text[len(prefix):].rstrip(';'))
    if len(species)!=53 or len(set(x['latin'] for x in species))!=53:
        raise ValueError('Species catalog changed: expected exactly 53 taxa')
    deadline=time.monotonic()+int(os.getenv('MOOLVA_PHOTO_BUDGET_SECONDS','180'))
    limit=int(os.getenv('MOOLVA_PHOTO_LIMIT','53'))
    result={}
    misses=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        futures={pool.submit(acquire,s,deadline):s for s in species[:limit]}
        for future in concurrent.futures.as_completed(futures):
            latin,info,reason=future.result()
            if info: result[latin]=info
            else:misses.append({'latin':latin,'reason':reason})
    payload='window.MOOLVA_PHOTOS='+json.dumps(result,ensure_ascii=False,separators=(',',':'))+';\n'
    (ROOT/'photos.js').write_text(payload,encoding='utf8')
    (ROOT/'photo-report.json').write_text(json.dumps({'species':len(species),
        'photos':len(result),'missing':len(species)-len(result),'manualReviewComplete':False,
        'warnings':'Wikimedia category and license prove neither visual identification nor local occurrence',
        'failed':misses},ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps({'species':len(species),'licensedPhotos':len(result),'missing':len(species)-len(result)},ensure_ascii=False),flush=True)

if __name__=='__main__':
    main()
