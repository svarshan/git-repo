#!/usr/bin/env python3
"""Build a genuinely offline, simplified map from a regional OpenStreetMap PBF.
The input is original OSM open-data; this derivative geodatabase is ODbL 1.0.
No official OSM tile server is scraped. Do not associate road/forest objects
with GBIF bird sightings; sightings remain independent coarsened evidence.
"""
import datetime
import hashlib
import heapq
import json
import math
import os
from pathlib import Path
import tempfile
import time

import requests
import osmium

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app"
URLS = [
 "https://geo2day.com/russia/volga_federal_district/nizhny_novgorod_oblast.pbf",
 "https://osmtoday.com/russia/volga_federal_district/nizhny_novgorod_oblast.pbf",
]
B = dict(west=41.60, east=47.96, south=54.35, north=58.19)
SOURCES = {"osm": "© OpenStreetMap contributors", "license": "ODbL 1.0",
           "licenseUrl": "https://www.openstreetmap.org/copyright"}
OUTPUT = APP / "atlas-ultra-data.js"
LIMITS = dict(road=12500, river=3500, lake=2400, forest=2200, place=3200)
RANK = {"motorway": 1, "trunk": 1, "primary": 2, "secondary": 3,
        "tertiary": 4, "unclassified": 5, "residential": 5}
KEEP_ROAD = set(RANK)
# Simplify in screen-space pixels at the full-oblast zoom, not in arbitrary degrees.
def project(lat, lon):
    return (int(round(1200 * (lon - B["west"]) / (B["east"] - B["west"]))),
            int(round(942 * (B["north"] - lat) / (B["north"] - B["south"]))))

def dist(a,b):
    return math.hypot(b[0]-a[0], b[1]-a[1])

def simplify(coords, eps):
    if len(coords) <= 2: return coords
    keep = [False] * len(coords)
    keep[0] = keep[-1] = True
    pending = [(0, len(coords)-1)]
    while pending:
        a,b = pending.pop()
        if b-a <= 1: continue
        x1,y1 = coords[a];x2,y2 = coords[b]
        vx,vy = x2-x1,y2-y1
        denom = vx*vx + vy*vy
        best = -1;best_i = None
        for i in range(a+1,b):
            px,py = coords[i]
            if denom:
                t = max(0.0,min(1.0,((px-x1)*vx+(py-y1)*vy)/denom))
                d = math.hypot(px-x1-t*vx, py-y1-t*vy)
            else: d = math.hypot(px-x1,py-y1)
            if d>best: best,best_i=d,i
        if best>eps:
            keep[best_i] = True
            pending.extend([(a,best_i),(best_i,b)])
    return [p for p,k in zip(coords,keep) if k]

def area(c):
    return abs(sum(c[i][0]*c[i+1][1] - c[i+1][0]*c[i][1] for i in range(len(c)-1))) / 2

class MapExtractor(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.h = {key:[] for key in LIMITS}
        self.count = {key:0 for key in LIMITS}
        self.serial = 0
        self.named = {}
    def add(self, kind, score, payload):
        # Keep informative ways if the file is large instead of truncating the
        # first N items in arbitrary OSM file order.
        self.serial += 1
        heap = self.h[kind]
        item = (float(score), self.serial, payload)
        if len(heap)<LIMITS[kind]: heapq.heappush(heap, item)
        elif score > heap[0][0]: heapq.heapreplace(heap,item)
        self.count[kind] += 1
    def node(self,n):
        try:
            tags=n.tags
            place=tags.get("place","")
            if place not in ("city","town","village","hamlet","suburb","isolated_dwelling"):return
            name=str(tags.get("name:ru") or tags.get("name") or "").strip()
            if not name or len(name)>75:return
            lon=float(n.location.lon);lat=float(n.location.lat)
            if not B["west"]<=lon<=B["east"] or not B["south"]<=lat<=B["north"]:return
            tier={"city":1,"town":2,"village":3,"suburb":3,"hamlet":4,"isolated_dwelling":5}[place]
            pop=str(tags.get("population") or "").replace(" ","")
            try: population=int(pop)
            except ValueError:population=0
            if tier==5 and population<10:return
            priority=600-tier*100 + min(population,500000)/2000
            ident=name.casefold()+"/"+str(round(lat,2))+"/"+str(round(lon,2))
            old=self.named.get(ident)
            if old and old[0]>=priority:return
            obj={"name":name,"lat":round(lat,5),"lon":round(lon,5),"tier":tier}
            self.named[ident]=(priority,obj)
            self.count['place'] += 1
        except (ValueError,RuntimeError):return
    def way(self,w):
        tags=w.tags
        highway=tags.get("highway","")
        waterway=tags.get("waterway","")
        lake=(tags.get("natural")=="water" or tags.get("waterway")=="riverbank")
        forest=(tags.get("landuse")=="forest" or tags.get("natural")=="wood")
        if highway not in KEEP_ROAD and waterway not in ("river","stream","canal") and not lake and not forest:return
        try:
            coords=[project(float(n.location.lat),float(n.location.lon)) for n in w.nodes if n.location.valid()]
        except (RuntimeError, ValueError):return
        if len(coords)<2:return
        xs=[x for x,_ in coords];ys=[y for _,y in coords]
        if max(xs)<0 or min(xs)>1200 or max(ys)<0 or min(ys)>942:return
        polygon = len(coords)>=4 and coords[0]==coords[-1]
        if (lake or forest) and polygon:
            a=area(coords)
            if a < (0.16 if lake else 2.0):return
            out=simplify(coords,1.6 if lake else 2.6)
            if out[0]!=out[-1]:out.append(out[0])
            if len(out)<4:return
            kind="lake" if lake else "forest"
            self.add(kind,a,out)
            return
        if highway in KEEP_ROAD:
            kind="road";rank=RANK[highway]
            precision=0.35 if rank<=3 else 0.9
        elif waterway in ("river","stream","canal"):
            kind="river";rank=1 if waterway=="river" else 2
            precision=0.6 if rank==1 else 1.3
        else:return
        out=simplify(coords,precision)
        distance=sum(dist(a,b) for a,b in zip(out,out[1:]))
        if distance < (2.5 if kind=="road" else 3):return
        score=distance*(7-rank if kind=="road" else (5 if rank==1 else .4))
        self.add(kind,score,[rank,out])
    def build(self, meta):
        featured=[x[1] for x in sorted(self.named.values(),key=lambda x:-x[0])[:LIMITS["place"]]]
        counts={k:len(v) for k,v in self.h.items()}
        result={**SOURCES, **meta, "bounds":B,
                "roads":[x[2] for x in self.h["road"]],
                "rivers":[x[2] for x in self.h["river"]],
                "lakes":[x[2] for x in self.h["lake"]],
                "forests":[x[2] for x in self.h["forest"]],
                "places":featured,
                "selectedCounts":{**counts,"place":len(featured)},
                "examinedCounts":self.count}
        return result

def download():
    cache=Path(tempfile.gettempdir())/"ptitsy-nizhny-oblast-72.osm.pbf"
    if cache.exists() and 15_000_000<cache.stat().st_size<200_000_000:
        print("Existing verified-size regional extract", cache.stat().st_size)
        return cache,URLS[0]
    errors=[]
    for url in URLS:
        for attempt in range(2):
            try:
                print("Regional OSM extract",url,"attempt",attempt+1,flush=True)
                with requests.get(url,stream=True,timeout=(20,120),headers={"User-Agent":"MoOLVaOfflineFieldAtlas/7.2 (OpenStreetMap derivative)"}) as r:
                    r.raise_for_status()
                    with cache.open("wb") as h:
                        size=0
                        for chunk in r.iter_content(1024*1024):
                            if chunk:
                                size+=len(chunk)
                                if size>180_000_000:raise RuntimeError("Unexpected large input")
                                h.write(chunk)
                if cache.stat().st_size<15_000_000:raise RuntimeError("Truncated regional PBF")
                if cache.open("rb").read(3)!=b"\x00\x00\x00":
                    # PBF header length starts with 4-byte network-order value, usually 0x000000xx.
                    raise RuntimeError("Unexpected input header")
                return cache,url
            except Exception as e:
                errors.append(str(e));print("Extract retry:",str(e),flush=True)
                cache.unlink(missing_ok=True)
                time.sleep(2)
    raise RuntimeError("No licensed genuine regional map extract available: "+"; ".join(errors[-4:]))

def main():
    pbf,url=download()
    sha=hashlib.sha256()
    with pbf.open("rb") as f:
        for part in iter(lambda:f.read(1024*1024),b""):sha.update(part)
    proc=MapExtractor()
    proc.apply_file(str(pbf),locations=True,idx="flex_mem")
    data=proc.build({"sourceUrl":url,"sourceSha256":sha.hexdigest(),
                     "generatedUtc":datetime.datetime.now(datetime.timezone.utc).date().isoformat()})
    selected=data["selectedCounts"]
    print("OSM source feature counts",data["examinedCounts"],"selected",selected,flush=True)
    if min(selected["road"],selected["river"],selected["forest"],selected["lake"],selected["place"])<50:
        raise RuntimeError("Incomplete detailed offline OSM features; refusing to claim ULTRA map")
    text="window.MOOLVA_ULTRA_MAP="+json.dumps(data,ensure_ascii=False,separators=(",",":"))+";\n"
    if len(text)>9_000_000:raise RuntimeError("Offline map too large: "+str(len(text)))
    OUTPUT.write_text(text,encoding="utf8")
    print("Created offline OSM geographic database",OUTPUT,len(text),"sha256",sha.hexdigest(),flush=True)

if __name__=="__main__":
    main()
