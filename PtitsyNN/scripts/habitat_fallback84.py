#!/usr/bin/env python3
"""Independent iNaturalist region-specific backup for temporary GBIF API failures.

Only research-grade, unobscured and openly reusable observation metadata
from the real iNaturalist place 134584 (Nizhegorodskaya obl), NOT generic
bounding-box guesswork. Returned rows are GBIF-shaped for the existing privacy
filter / two-date aggregation; no individual positions leave the build process.
"""
from datetime import date
import re
import requests

API="https://api.inaturalist.org/v1/observations"
PLACE_ID=134584
PLACE_URL="https://www.inaturalist.org/places/134584"
LICENSES={"cc0":"CC0_1_0","cc-by":"CC_BY_4_0","cc-by-sa":"CC_BY_SA_4_0"}

def normalize(observation):
 if not isinstance(observation,dict) or observation.get('quality_grade')!='research':return None
 if observation.get('geoprivacy') not in (None,'','open') or observation.get('coordinates_obscured'):return None
 if observation.get('private_place_guess') or observation.get('id') is None:return None
 if observation.get('license_code') not in LICENSES:return None
 places=observation.get('place_ids')
 if isinstance(places,list) and places and PLACE_ID not in places:return None
 taxon=observation.get('taxon') or {}
 if taxon.get('rank')!='species' or not re.fullmatch(r'[A-Z][a-z]+ [a-z]+',str(taxon.get('name') or '')):return None
 geo=observation.get('geojson') or {}
 coords=geo.get('coordinates')
 if not isinstance(coords,(list,tuple)) or len(coords)!=2:return None
 try:
  lon,lat=map(float,coords)
  if not (41.60<=lon<=47.96 and 54.35<=lat<=58.19):return None
  accuracy=observation.get('positional_accuracy')
  if accuracy is not None and float(accuracy)>5000:return None
 except (ValueError,TypeError):return None
 observed=observation.get('observed_on') or ''
 if not isinstance(observed,str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}',observed):return None
 try:d=date.fromisoformat(observed)
 except ValueError:return None
 if d.year<2016:return None
 return {
  'stateProvince':'Nizhegorodskaya obl (iNaturalist place 134584)',
  'species':taxon['name'],'license':LICENSES[observation['license_code']],
  'occurrenceStatus':'PRESENT','issues':[],
  'year':d.year,'month':d.month,'eventDate':observed,
  'decimalLatitude':lat,'decimalLongitude':lon,
  'coordinateUncertaintyInMeters':accuracy or 0,
 }

def fetch(get, max_pages=18):
 """Use a region ID, date cohorts and a hard bound; no synthetic observations."""
 seen=set();records=[];queries=0;issues=[]
 cohorts=[('2017-01-01','2020-12-31'),('2021-01-01','2023-12-31'),('2024-01-01',date.today().isoformat())]
 for d1,d2 in cohorts:
  if d1>d2:continue
  for page in range(1,1+max(1,max_pages//len(cohorts))):
   params={'place_id':PLACE_ID,'taxon_id':3,'quality_grade':'research',
      'geo':'true','d1':d1,'d2':d2,'per_page':200,'page':page,'order_by':'observed_on','order':'desc'}
   try:
    payload=get(API,params=params,retries=1,timeout=22).json()
   except (requests.RequestException,ValueError,RuntimeError) as e:
    issues.append(str(e)[:120]);break
   batch=payload.get('results') if isinstance(payload,dict) else None
   if not isinstance(batch,list):issues.append('Malformed iNaturalist response');break
   queries+=len(batch)
   for x in batch:
    if not isinstance(x,dict) or x.get('id') in seen:continue
    seen.add(x['id'])
    normalized=normalize(x)
    if normalized:records.append(normalized)
   if len(batch)<200:break
 print('INAT NIZHNY FALLBACK',{'queried':queries,'licensedResearch':len(records),'errors':issues[:3]},flush=True)
 return records,queries,issues
