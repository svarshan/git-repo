#!/usr/bin/env python3
"""Stage 2.0: region-scoped published community observations. Never infer edibility or protected status."""
import json
import os
import re
import time
from pathlib import Path

import requests

ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'catalog.js'
OUT=ROOT/'region20.js'
REPORT=ROOT/'region20-report.json'
API='https://api.inaturalist.org/v1'
HEADERS={'User-Agent':'MoOLVaGriby/2.0 (offline regional species evidence; github.com/svarshan/git-repo)'}
# Broad envelope only for additional validation. The actual place polygon must come
# from iNaturalist's recognised Nizhny Novgorod Oblast place.
BOUNDS=(54.1,58.2,41.2,48.2)
PLACE_TERMS=('nizhny novgorod oblast','nizhny novgorod region','нижегородская область')
FAMILIES={
 'Amanitaceae','Boletaceae','Suillaceae','Russulaceae','Cortinariaceae',
 'Tricholomataceae','Agaricaceae','Hygrophoraceae','Gomphaceae','Cantharellaceae',
 'Hydnaceae','Morchellaceae','Helvellaceae','Pezizaceae','Polyporaceae',
 'Fomitopsidaceae','Ganodermataceae','Pleurotaceae','Strophariaceae',
 'Mycenaceae','Marasmiaceae','Hymenogastraceae','Physalacriaceae','Psathyrellaceae',
 'Inocybaceae','Entolomataceae','Clavulinaceae','Ramariaceae','Tremellaceae',
 'Lyophyllaceae','Auriculariaceae','Hericiaceae','Dacrymycetaceae','Pluteaceae',
 'Clavariaceae','Geastraceae','Phallaceae','Stereaceae','Schizophyllaceae',
 'Hymenochaetaceae','Lycoperdaceae','Hydnangiaceae','Omphalotaceae'
}
MACRO_GENERA=set('Agaricus Amanita Armillaria Auricularia Boletus Butyriboletus Calocera Calvatia Cantharellus Chlorophyllum Clavaria Clavulina Clavulinopsis Clitocybe Collybia Coprinellus Coprinopsis Coprinus Cortinarius Craterellus Cystoderma Cystolepiota Dacrymyces Entoloma Exidia Flammulina Fomes Fomitopsis Ganoderma Geastrum Gomphidius Gomphus Gyromitra Hebeloma Helvella Hericium Hydnum Hygrocybe Hygrophorus Hypholoma Imleria Inocybe Inonotus Kuehneromyces Lactarius Lactifluus Laetiporus Leccinum Lepiota Leucocoprinus Lycoperdon Lyophyllum Macrolepiota Marasmius Melanoleuca Morchella Mycena Omphalotus Otidea Paxillus Peziza Phallus Pholiota Pleurotus Pluteus Polyporus Psathyrella Ramaria Russula Sarcoscypha Sarcodon Schizophyllum Scleroderma Strobilurus Stropharia Suillus Tapinella Trametes Tricholoma Tremella Tylopilus Xerocomellus Xerocomus Volvopluteus Volvariella'.split())
BINOMIAL=re.compile(r'^[A-Z][a-z-]+ [a-z-]+
MAX_SPECIES=300

def get(endpoint,params=None):
    res=requests.get(API+endpoint,params=params,headers=HEADERS,timeout=23)
    res.raise_for_status()
    return res.json()

def permitted_place(place):
    name=str(place.get('name') or place.get('display_name') or '').casefold().replace('-',' ')
    match=any(term in name for term in PLACE_TERMS)
    try:
        lat,lon=float(place.get('latitude')),float(place.get('longitude'))
        bounds=BOUNDS[0]<=lat<=BOUNDS[1] and BOUNDS[2]<=lon<=BOUNDS[3]
    except (ValueError,TypeError):bounds=False
    return match and bounds and bool(place.get('id'))

def choose_place():
    for term in ['Nizhny Novgorod Oblast','Nizhny Novgorod','Нижегородская область']:
        for endpoint in ['/places/autocomplete','/places']:
            try:
                data=get(endpoint,{'q':term,'per_page':30})
                for place in data.get('results',[]):
                    if permitted_place(place):return place
            except (requests.RequestException,KeyError,ValueError):continue
    return None

def default_output(reason,place=None):
    return {'schema':2,'source':'iNaturalist','status':'not-loaded','reason':reason,
            'placeId':place.get('id') if place else None,'place':place.get('name') if place else '',
            'evidenceCount':0,'recordCount':0,'species':[],'observations':[],
            'notes':'No unpublished coordinates, invented records, or unverified edible mushroom labels.'}

def gather():
    text=BASE.read_text(encoding='utf8').strip()
    prefix='window.MOOLVA_MUSHROOMS='
    if not text.startswith(prefix):raise ValueError('Base catalog data missing')
    base=json.loads(text[len(prefix):].rstrip(';'))
    baseNames={x['latin'] for x in base}
    place=choose_place()
    if not place:return default_output('Exact Nizhny Novgorod Oblast place was not verified by the provider')
    query={'place_id':place['id'],'taxon_id':47170,'quality_grade':'research','per_page':500,'page':1}
    records=[]
    for n in [1,2,3]:
        query['page']=n
        data=get('/observations/species_counts',query)
        records.extend(data.get('results') or [])
        if len(data.get('results') or [])<500:break
        time.sleep(.7)
    candidates=[]
    for row in records:
        taxon=row.get('taxon') or {}
        latin=taxon.get('name') or ''
        if not BINOMIAL.fullmatch(latin) or taxon.get('rank')!='species':continue
        if taxon.get('iconic_taxon_name') not in ('Fungi',None):continue
        if latin.split(' ')[0] not in MACRO_GENERA:continue
        if int(row.get('count') or 0)<2 or latin in baseNames:continue
        candidates.append((latin,taxon,int(row.get('count') or 0)))
    candidates.sort(key=lambda x:(-x[2],x[0]))
    species=[]
    for latin,taxon,count in candidates[:max(0,MAX_SPECIES-len(base))]:
        species.append({
            'id':'inat'+str(taxon['id']),'name':latin,'latin':latin,
            'group':'Региональные публикации','risk':'неопределён','months':[],
            'habitat':'Есть опубликованные наблюдения сообщества iNaturalist в выбранной области',
            'traits':'Описания отличительных признаков пока нет; требуется научная проверка.',
            'similar':'','regionVerified':False,
            'regionEvidence':{'provider':'iNaturalist','place':place.get('name'),
                              'count':count,'taxonId':taxon['id'],
                              'source':'https://www.inaturalist.org/taxa/'+str(taxon['id'])}})
    observations=[]
    for page in [1,2,3]:
        data=get('/observations',{'place_id':place['id'],'taxon_id':47170,
            'quality_grade':'research','geo':'true','per_page':200,'page':page,
            'order_by':'observed_on','order':'desc'})
        for x in data.get('results') or []:
            taxon=x.get('taxon') or {}
            name=taxon.get('name') or ''
            if not BINOMIAL.fullmatch(name) or taxon.get('rank')!='species':continue
            if x.get('obscured') or x.get('geoprivacy') not in (None,'open'):continue
            if x.get('taxon_geoprivacy') not in (None,'open'):continue
            try:
                lat,lon=float(x.get('latitude')),float(x.get('longitude'))
                accuracy=int(x.get('positional_accuracy') or 0)
            except (ValueError,TypeError):continue
            if not(BOUNDS[0]<=lat<=BOUNDS[1] and BOUNDS[2]<=lon<=BOUNDS[3]):continue
            if accuracy>10000:continue
            date=str(x.get('observed_on') or '')
            try:month=int(date[5:7])
            except ValueError:month=0
            observations.append({'id':int(x['id']),'latin':name,'lat':lat,'lon':lon,
                'date':date,'month':month,'grade':'research','obscured':False,
                'source':'https://www.inaturalist.org/observations/'+str(x['id'])})
        if len(data.get('results') or [])<200 or len(observations)>=300:break
        time.sleep(.7)
    return {'schema':2,'source':'iNaturalist','status':'published-community-observations',
        'placeId':place['id'],'place':place.get('name','Nizhny Novgorod Oblast'),
        'evidenceCount':len(observations),'recordCount':len(species),
        'species':species,'observations':observations[:300],
        'notes':'Public research-grade community observations. Not expert-confirmed species, human safety, or absence evidence.'}

def main():
    try:result=gather()
    except (requests.RequestException,ValueError,TypeError,KeyError) as exc:result=default_output(str(exc)[:200])
    OUT.write_text('window.MOOLVA_EXTRA_SPECIES20='+json.dumps(result['species'],ensure_ascii=False,separators=(',',':'))+';\n'+
       'window.MOOLVA_REGION_OBS20='+json.dumps(result['observations'],ensure_ascii=False,separators=(',',':'))+';\n'+
       'window.MOOLVA_REGION_META20='+json.dumps({k:v for k,v in result.items() if k not in ('species','observations')},
         ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf8')
    REPORT.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps({k:v for k,v in result.items() if k not in ('species','observations')},ensure_ascii=False))
    # Fail softly on unavailable public data, preserving 53 safe offline entries.

if __name__=='__main__':main()
)
MAX_SPECIES=300

def get(endpoint,params=None):
    res=requests.get(API+endpoint,params=params,headers=HEADERS,timeout=23)
    res.raise_for_status()
    return res.json()

def permitted_place(place):
    name=str(place.get('name') or place.get('display_name') or '').casefold().replace('-',' ')
    match=any(term in name for term in PLACE_TERMS)
    try:
        lat,lon=float(place.get('latitude')),float(place.get('longitude'))
        bounds=BOUNDS[0]<=lat<=BOUNDS[1] and BOUNDS[2]<=lon<=BOUNDS[3]
    except (ValueError,TypeError):bounds=False
    return match and bounds and bool(place.get('id'))

def choose_place():
    for term in ['Nizhny Novgorod Oblast','Nizhny Novgorod','Нижегородская область']:
        for endpoint in ['/places/autocomplete','/places']:
            try:
                data=get(endpoint,{'q':term,'per_page':30})
                for place in data.get('results',[]):
                    if permitted_place(place):return place
            except (requests.RequestException,KeyError,ValueError):continue
    return None

def default_output(reason,place=None):
    return {'schema':2,'source':'iNaturalist','status':'not-loaded','reason':reason,
            'placeId':place.get('id') if place else None,'place':place.get('name') if place else '',
            'evidenceCount':0,'recordCount':0,'species':[],'observations':[],
            'notes':'No unpublished coordinates, invented records, or unverified edible mushroom labels.'}

def gather():
    text=BASE.read_text(encoding='utf8').strip()
    prefix='window.MOOLVA_MUSHROOMS='
    if not text.startswith(prefix):raise ValueError('Base catalog data missing')
    base=json.loads(text[len(prefix):].rstrip(';'))
    baseNames={x['latin'] for x in base}
    place=choose_place()
    if not place:return default_output('Exact Nizhny Novgorod Oblast place was not verified by the provider')
    query={'place_id':place['id'],'taxon_id':47170,'quality_grade':'research','per_page':500,'page':1}
    records=[]
    for n in [1,2,3]:
        query['page']=n
        data=get('/observations/species_counts',query)
        records.extend(data.get('results') or [])
        if len(data.get('results') or [])<500:break
        time.sleep(.7)
    candidates=[]
    for row in records:
        taxon=row.get('taxon') or {}
        latin=taxon.get('name') or ''
        if not BINOMIAL.fullmatch(latin) or taxon.get('rank')!='species':continue
        if taxon.get('iconic_taxon_name') not in ('Fungi',None):continue
        if str(taxon.get('family') or (taxon.get('listed_taxa') or [{}])[0].get('family') or '') not in FAMILIES:
            # iNaturalist taxa often omit family in species_counts; accept only
            # macroscopic members after a verified direct taxon lookup.
            family_ok=False
            for ancestor in taxon.get('ancestors') or []:
                if ancestor.get('rank')=='family' and ancestor.get('name') in FAMILIES:family_ok=True
            if not family_ok:continue
        if int(row.get('count') or 0)<2 or latin in baseNames:continue
        candidates.append((latin,taxon,int(row.get('count') or 0)))
    candidates.sort(key=lambda x:(-x[2],x[0]))
    species=[]
    for latin,taxon,count in candidates[:max(0,MAX_SPECIES-len(base))]:
        species.append({
            'id':'inat'+str(taxon['id']),'name':latin,'latin':latin,
            'group':'Региональные публикации','risk':'неопределён','months':[],
            'habitat':'Есть опубликованные наблюдения сообщества iNaturalist в выбранной области',
            'traits':'Описания отличительных признаков пока нет; требуется научная проверка.',
            'similar':'','regionVerified':False,
            'regionEvidence':{'provider':'iNaturalist','place':place.get('name'),
                              'count':count,'taxonId':taxon['id'],
                              'source':'https://www.inaturalist.org/taxa/'+str(taxon['id'])}})
    observations=[]
    for page in [1,2,3]:
        data=get('/observations',{'place_id':place['id'],'taxon_id':47170,
            'quality_grade':'research','geo':'true','per_page':200,'page':page,
            'order_by':'observed_on','order':'desc'})
        for x in data.get('results') or []:
            taxon=x.get('taxon') or {}
            name=taxon.get('name') or ''
            if not BINOMIAL.fullmatch(name) or taxon.get('rank')!='species':continue
            if x.get('obscured') or x.get('geoprivacy') not in (None,'open'):continue
            if x.get('taxon_geoprivacy') not in (None,'open'):continue
            try:
                lat,lon=float(x.get('latitude')),float(x.get('longitude'))
                accuracy=int(x.get('positional_accuracy') or 0)
            except (ValueError,TypeError):continue
            if not(BOUNDS[0]<=lat<=BOUNDS[1] and BOUNDS[2]<=lon<=BOUNDS[3]):continue
            if accuracy>10000:continue
            date=str(x.get('observed_on') or '')
            try:month=int(date[5:7])
            except ValueError:month=0
            observations.append({'id':int(x['id']),'latin':name,'lat':lat,'lon':lon,
                'date':date,'month':month,'grade':'research','obscured':False,
                'source':'https://www.inaturalist.org/observations/'+str(x['id'])})
        if len(data.get('results') or [])<200 or len(observations)>=300:break
        time.sleep(.7)
    return {'schema':2,'source':'iNaturalist','status':'published-community-observations',
        'placeId':place['id'],'place':place.get('name','Nizhny Novgorod Oblast'),
        'evidenceCount':len(observations),'recordCount':len(species),
        'species':species,'observations':observations[:300],
        'notes':'Public research-grade community observations. Not expert-confirmed species, human safety, or absence evidence.'}

def main():
    try:result=gather()
    except (requests.RequestException,ValueError,TypeError,KeyError) as exc:result=default_output(str(exc)[:200])
    OUT.write_text('window.MOOLVA_EXTRA_SPECIES20='+json.dumps(result['species'],ensure_ascii=False,separators=(',',':'))+';\n'+
       'window.MOOLVA_REGION_OBS20='+json.dumps(result['observations'],ensure_ascii=False,separators=(',',':'))+';\n'+
       'window.MOOLVA_REGION_META20='+json.dumps({k:v for k,v in result.items() if k not in ('species','observations')},
         ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf8')
    REPORT.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps({k:v for k,v in result.items() if k not in ('species','observations')},ensure_ascii=False))
    # Fail softly on unavailable public data, preserving 53 safe offline entries.

if __name__=='__main__':main()
