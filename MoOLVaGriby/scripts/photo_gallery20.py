#!/usr/bin/env python3
"""MoOLVa Griby 2.0: offline extra views from open-licensed taxon-linked photos."""
import concurrent.futures
import json
import os
from io import BytesIO
from pathlib import Path

import requests
from PIL import Image,ImageOps

from fetch_commons import ROOT, MEDIA, NAT_MEDIA, naturalist_get, license_ok, HEADERS

GALLERY=ROOT/'media'/'gallery'
OUT=ROOT/'photos-gallery20.js'
REPORT=ROOT/'photo-gallery20-report.json'

def eligible(photo):
    return (photo and photo.get('id') and license_ok(photo.get('license_code'))
            and str(photo.get('url') or '').startswith(NAT_MEDIA))

def transform(latin,photo,number):
    url=str(photo['url'])
    for kind in ('square','small','thumb'):
        url=url.replace('/'+kind+'.','/medium.')
    if not url.startswith(NAT_MEDIA):return None
    r=requests.get(url,headers=HEADERS,timeout=14)
    if r.status_code!=200 or len(r.content)>3_000_000:return None
    with Image.open(BytesIO(r.content)) as img:
        img=ImageOps.exif_transpose(img)
        if min(img.size)<160:return None
        img=img.convert('RGB');img.thumbnail((780,620))
        GALLERY.mkdir(parents=True,exist_ok=True)
        dest=GALLERY/(latin.replace(' ','_')+'-'+str(number)+'.jpg')
        img.save(dest,quality=83,optimize=True)
    return {'file':'media/gallery/'+dest.name,
            'source':'https://www.inaturalist.org/photos/'+str(photo['id']),
            'author':str(photo.get('attribution') or 'iNaturalist user')[:240],
            'license':str(photo.get('license_code','')).upper(),
            'review':'licensed open media, visual verification pending'}

def gather(species,limit):
    latin=species['latin']
    if limit<=0:return latin,[]
    try:
        observations=naturalist_get('/observations',{
            'taxon_name':latin,'quality_grade':'research','photos':'true',
            'per_page':18,'order_by':'votes'})
        result=[];seen=set()
        for obs in observations.get('results') or []:
            if str((obs.get('taxon') or {}).get('name','')).lower()!=latin.lower():continue
            for photo in obs.get('photos') or []:
                if not eligible(photo) or photo['id'] in seen:continue
                seen.add(photo['id'])
                try:item=transform(latin,photo,len(result)+1)
                except (OSError,ValueError,requests.RequestException):item=None
                if item:result.append(item)
                if len(result)>=limit:return latin,result
        return latin,result
    except (OSError,ValueError,requests.RequestException,KeyError):
        return latin,[]

def main():
    source=(ROOT/'catalog.js').read_text(encoding='utf8').strip()
    primary=json.loads(source.split('=',1)[1].rstrip(';'))
    number=min(53,max(0,int(os.getenv('MOOLVA_GALLERY_SPECIES','28'))))
    per_species=min(4,max(1,int(os.getenv('MOOLVA_GALLERY_PER_SPECIES','2'))))
    result={}
    # A limited, rate-controlled subset is deliberately better than an
    # unlicensed 3-6 photograph claim across the full catalog.
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for latin,photos in pool.map(lambda x:gather(x,per_species),primary[:number]):
            if photos:result[latin]=photos
    OUT.write_text('window.MOOLVA_GALLERY20='+json.dumps(result,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf8')
    report={'requestedSpecies':number,'targetPhotosPerSpecies':per_species,
            'speciesWithExtras':len(result),'actualExtraPhotos':sum(map(len,result.values())),
            'allPhotosVisualReviewPending':True,'licenseFilter':'CC BY, CC BY-SA or CC0',
            'note':'Photo source taxon is community metadata, not independently verified specimen identity.'}
    REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps(report,ensure_ascii=False),flush=True)

if __name__=='__main__':main()
