#!/usr/bin/env python3
"""Fetch real Commons photos for an offline atlas; do not claim visual species verification."""
from __future__ import annotations
import concurrent.futures
import html
import json
import os
import re
import time
import threading
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


# iNaturalist photo licenses differ per contributor. Accept only open media
# (CC0, CC BY, CC BY-SA). Taxonomic metadata does not establish species identity.
NAT='https://api.inaturalist.org/v1'
NAT_MEDIA='https://inaturalist-open-data.s3.amazonaws.com/photos/'
_naturalist_lock=threading.Lock()
_naturalist_last=[0.0]

def naturalist_get(endpoint,params):
    with _naturalist_lock:
        pause=1.15-(time.monotonic()-_naturalist_last[0])
        if pause>0:time.sleep(pause)
        _naturalist_last[0]=time.monotonic()
    response=requests.get(NAT+endpoint,params=params,headers=HEADERS,timeout=17)
    if response.status_code==429:
        time.sleep(3)
        response=requests.get(NAT+endpoint,params=params,headers=HEADERS,timeout=17)
    response.raise_for_status()
    return response.json()

def downloaded_photo(latin,photo,source):
    code=str(photo.get('license_code') or '').upper()
    if not license_ok(code):return None
    url=photo.get('medium_url') or photo.get('url') or ''
    if '/square.' in url:url=url.replace('/square.','/medium.')
    if not url.startswith(NAT_MEDIA):return None
    response=requests.get(url,timeout=18,headers=HEADERS)
    if response.status_code!=200 or len(response.content)>3_000_000:return None
    from io import BytesIO
    with Image.open(BytesIO(response.content)) as raw:
        picture=ImageOps.exif_transpose(raw)
        if min(picture.size)<190:return None
        picture=picture.convert('RGB');picture.thumbnail((740,600))
        MEDIA.mkdir(parents=True,exist_ok=True)
        file=MEDIA/(latin.replace(' ','_')+'.jpg')
        picture.save(file,quality=83,optimize=True)
    return {'file':'media/photos/'+file.name,'source':source,
            'author':str(photo.get('attribution') or 'iNaturalist photographer')[:240],
            'license':code.replace('_','-'),
            'review':'iNaturalist exact taxon metadata; visual identity still requires human verification'}

def acquire_naturalist(species,deadline):
    latin=species['latin']
    if time.monotonic()>deadline:return latin,None,'deadline'
    try:
        data=naturalist_get('/taxa',{'q':latin,'rank':'species','per_page':10})
        exact=next((t for t in data.get('results',[]) if str(t.get('name','')).casefold()==latin.casefold() and t.get('rank')=='species'),None)
        if not exact:return latin,None,'no exact species taxon'
        default=exact.get('default_photo') or {}
        if default.get('id'):
            found=downloaded_photo(latin,default,'https://www.inaturalist.org/photos/'+str(default['id']))
            if found:return latin,found,None
        if time.monotonic()>deadline:return latin,None,'deadline'
        observations=naturalist_get('/observations',{
            'taxon_id':exact['id'],'quality_grade':'research','photos':'true',
            'photo_license':'cc-by,cc-by-sa,cc0','per_page':'20','order_by':'votes'})
        for obs in observations.get('results',[]):
            if str((obs.get('taxon') or {}).get('name','')).casefold()!=latin.casefold():continue
            for photo in obs.get('photos',[]):
                if not photo.get('id'):continue
                found=downloaded_photo(latin,photo,'https://www.inaturalist.org/photos/'+str(photo['id']))
                if found:return latin,found,None
        return latin,None,'no eligible openly-licensed iNaturalist photo'
    except (requests.RequestException,ValueError,OSError,KeyError) as exc:
        return latin,None,'iNaturalist: '+str(exc)[:145]

def acquire_any(species,deadline):
    taxon,found,reason=acquire_naturalist(species,deadline)
    if found:return taxon,found,None
    if time.monotonic()>deadline:return taxon,None,reason
    second=acquire(species,deadline)
    if second[1]:return second
    return taxon,None,reason+' / Commons: '+str(second[2])

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
        futures={pool.submit(acquire_any,s,deadline):s for s in species[:limit]}
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
