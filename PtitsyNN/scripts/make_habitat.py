#!/usr/bin/env python3
"""MoOLVa 5.0. Bundle a real region map and responsibly coarsened GBIF observation cells.

No personal journal positions. Observations are not predictions and never expose raw
coordinates or observation identifiers. GBIF search is a bounded sample, not a census.
"""
import collections
import datetime
import json
import math
import os
from pathlib import Path
import re
import time
import requests

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app"
HEADERS = {"User-Agent": "MoOLVaBirdAtlas/5.0 (desktop offline research map; source: gbif.org)"}
# Wikimedia authored georeferenced map, lat/long edges from source page.
MAP_URL = "https://github.com/antibioticbook/russian-geo-data/blob/master/geo.json"
MAP_SOURCE = MAP_URL
MAP_AUTHOR = "antibioticbook/russian-geo-data (CC0 repository; original GADM geographical boundaries)"
MAP_LICENSE_URL = "https://creativecommons.org/publicdomain/zero/1.0/"
GEO = dict(north=58.19, south=54.35, west=41.60, east=47.96)
MAX_PAGES = 24
LIMIT = 300
GRID_LAT = 0.3
GRID_LON = 0.5
VALID_LICENSES = {"cc0_1_0", "cc_by_4_0", "cc_by_sa_4_0"}
def license_allowed(value):
    license_value = str(value or "").strip().lower().replace("https://", "http://").rstrip("/")
    if license_value in VALID_LICENSES:
        return True
    return license_value in {
        "http://creativecommons.org/publicdomain/zero/1.0",
        "http://creativecommons.org/publicdomain/zero/1.0/legalcode",
        "http://creativecommons.org/licenses/by/4.0",
        "http://creativecommons.org/licenses/by/4.0/legalcode",
        "http://creativecommons.org/licenses/by-sa/4.0",
        "http://creativecommons.org/licenses/by-sa/4.0/legalcode",
    }
REGION_TERMS = ("нижегород", "nizhegor", "nizhni", "nizhny", "nijegor", "gor'kov", "gorky")
EXCLUDED_ISSUES = {"COUNTRY_COORDINATE_MISMATCH", "COORDINATE_INVALID", "GEODETIC_DATUM_INVALID"}
TODAY = datetime.datetime.now(datetime.timezone.utc).date().isoformat()

def get(url, params=None, retries=2, timeout=25):
    for attempt in range(retries + 1):
        try:
            response = requests.get(url, params=params, headers=HEADERS, timeout=timeout)
            response.raise_for_status()
            return response
        except Exception:
            if attempt == retries:
                raise
            time.sleep(1.5 * (attempt + 1))

def write_map():
    """The source-verified polygon is committed to the application itself.
    Never hotlink Wikimedia at build time (429 rate limit) or user runtime.
    """
    destination=APP/"nn-oblast-map.svg"
    if not destination.is_file():
        raise RuntimeError("Mandatory Nizhny Novgorod Oblast geographical outline not bundled")
    content=destination.read_bytes()
    if not (12000<len(content)<1000000 and b"<svg" in content and b"russian-geo-data" in content):
        raise RuntimeError("Invalid or non-attributed offline region map")
    if re.search(rb"<script|<foreignObject",content,re.I):
        raise RuntimeError("Unsafe SVG content detected")
    print("Bundled open region map, bytes",len(content),"origin",MAP_URL)

def valid_region(record):
    province = str(record.get("stateProvince") or "").lower()
    gadm = record.get("gadm") or {}
    if isinstance(gadm, dict):
        level = gadm.get("level1") or {}
        province += " " + str(level.get("name") or "").lower()
    return any(term in province for term in REGION_TERMS)

def name_key(value):
    return re.sub(r"\s+", " ", str(value or "").lower().strip())

def catalog():
    content = (APP / "data.js").read_text("utf8").strip()
    prefix = "window.BIRDS_DATA="
    if not content.startswith(prefix):
        raise RuntimeError("Missing validated offline species catalog")
    data = json.loads(content[len(prefix):].rstrip(";"))
    return {name_key(b["latin"]):b["id"] for b in data if b.get("latin") and b.get("id")}

def scan():
    catalog_names = catalog()
    allowed_ids=set(catalog_names.values())
    counts = collections.Counter()
    years = collections.defaultdict(set)
    dates = collections.defaultdict(set)
    labels = {}
    monthly = collections.defaultdict(collections.Counter)
    monthly_dates = collections.defaultdict(lambda: collections.defaultdict(set))
    queried=0
    accepted=0
    rejected=collections.Counter()
    seen_licenses=collections.Counter()
    qs = dict(
        country="RU", taxonKey=212, hasCoordinate="true",
        hasGeospatialIssue="false", limit=LIMIT,
        geometry="POLYGON((41.60 54.35,47.96 54.35,47.96 58.19,41.60 58.19,41.60 54.35))",
    )
    # Stratify by permitted source license AND historic period; otherwise recent
    # noncommercial citizen records crowd every page out of the first 4,500.
    cohorts = [
        ("CC_BY_4_0","2017,2020"), ("CC_BY_4_0","2021,2023"),
        ("CC_BY_4_0","2024,2026"), ("CC0_1_0","2017,2020"),
        ("CC0_1_0","2021,2023"), ("CC0_1_0","2024,2026"),
    ]
    def accept_record(r):
        nonlocal accepted
        if not valid_region(r):
            rejected["outside_region_or_unverified_province"]+=1
            return
        latin = name_key(r.get("species"))
        b_id = catalog_names.get(latin)
        if not b_id:
            rejected["not_catalog_species"]+=1
            return
        if r.get("occurrenceStatus") == "ABSENT":
            rejected["absence"]+=1
            return
        seen_licenses[str(r.get("license") or "")]+=1
        if not license_allowed(r.get("license")):
            rejected["license"]+=1
            return
        if r.get("informationWithheld") or r.get("dataGeneralizations"):
            rejected["redacted_data"]+=1
            return
        issues=set(r.get("issues") or ())
        if issues.intersection(EXCLUDED_ISSUES):
            rejected["geospatial"]+=1
            return
        uncertainty=r.get("coordinateUncertaintyInMeters")
        if uncertainty and float(uncertainty)>5000:
            rejected["imprecise"]+=1
            return
        yr = r.get("year")
        if not isinstance(yr,int) or yr<2016 or yr>int(TODAY[:4]):
            rejected["date"]+=1
            return
        try:
            lat=float(r["decimalLatitude"])
            lon=float(r["decimalLongitude"])
        except (TypeError, ValueError, KeyError):
            rejected["no_coords"]+=1
            return
        if not (GEO["south"]<=lat<=GEO["north"] and GEO["west"]<=lon<=GEO["east"]):
            rejected["outside_bbox"]+=1
            return
        row=math.floor((lat-GEO["south"])/GRID_LAT)
        col=math.floor((lon-GEO["west"])/GRID_LON)
        key=(row,col,b_id)
        counts[key]+=1
        years[key].add(yr)
        date_label = str(r.get("eventDate") or str(yr))[:10]
        dates[key].add(date_label)
        month = r.get("month")
        if isinstance(month,int) and 1 <= month <= 12:
            monthly[key][month] += 1
            monthly_dates[key][month].add(date_label)
        labels[b_id]=latin
        accepted+=1

    failures=0; successful_pages=0; source_name="GBIF occurrence/search"
    source_url="https://www.gbif.org/occurrence/search?country=RU&taxon_key=212"
    for page in range(MAX_PAGES):
        source_license,source_years=cohorts[page % len(cohorts)]
        offset=(page // len(cohorts))*LIMIT
        try:
            data=get("https://api.gbif.org/v1/occurrence/search",
                     {**qs,"license":source_license,"year":source_years,"offset":offset},
                     retries=1,timeout=18).json()
        except (requests.RequestException,ValueError,RuntimeError) as exc:
            failures+=1
            print("GBIF cohort unavailable",page+1,str(exc)[:180],flush=True)
            if failures>=3:break
            continue
        records=data.get("results",[]) if isinstance(data,dict) else None
        if not isinstance(records,list):
            failures+=1
            if failures>=3:break
            continue
        successful_pages+=1
        queried+=len(records)
        for record in records:
            accept_record(record)
        print(f"GBIF page {page+1}: scanned {queried}; accepted {accepted}; last page {len(records)}",flush=True)
    def has_publishable_cells():
        return any(n>=3 and len(dates[k])>=2 for k,n in counts.items())
    if not has_publishable_cells():
        # Retain only real observed coordinates; source boundaries are
        # verified by the iNaturalist region, not a bounding-box guess.
        from habitat_fallback84 import fetch, PLACE_URL
        alternative,checked,issues=fetch(get)
        if alternative:
            counts.clear();years.clear();dates.clear();labels.clear();monthly.clear();monthly_dates.clear()
            accepted=0;queried=checked
            for record in alternative:accept_record(record)
            source_name="iNaturalist research-grade CC observations, Nizhegorodskaya obl (place 134584)"
            source_url=PLACE_URL
        if not has_publishable_cells():
            raise RuntimeError("No verified multi-day bird occurrence zones from GBIF or iNaturalist; release blocked rather than inventing dots")
    print("HABITAT data source",source_name,"observed records",accepted,flush=True)
    print("GBIF filtering diagnostics:", dict(rejected))
    print("GBIF license distribution within regional catalog records:",dict(seen_licenses))
    # Mask unusual or one-off points; never ship individual source coordinates.
    by_cell=collections.defaultdict(list)
    for (row,col,b_id),n in counts.items():
        if n<3 or len(dates[(row,col,b_id)])<2:
            continue
        # Display months only with >=3 records across multiple days per coarse cell.
        shown_months = sorted(m for m, count in monthly[(row,col,b_id)].items()
                              if count >= 3 and len(monthly_dates[(row,col,b_id)][m]) >= 2)
        by_cell[(row,col)].append(dict(id=b_id, n=n, fromYear=min(years[(row,col,b_id)]),
                                        toYear=max(years[(row,col,b_id)]), months=shown_months))
    cells=[]
    for (row,col),species in by_cell.items():
        # Grid-centre coordinates rather than occurrence positions (coarse roughly 30 km).
        lat=round(GEO["south"]+(row+0.5)*GRID_LAT,3)
        lon=round(GEO["west"]+(col+0.5)*GRID_LON,3)
        if lat>GEO["north"] or lon>GEO["east"]:
            continue
        species.sort(key=lambda x:(-x["n"],x["id"]))
        cells.append(dict(lat=lat,lon=lon,species=species[:35],total=sum(x["n"] for x in species)))
    cells.sort(key=lambda x:-x["total"])
    return dict(
        generated=TODAY, source=source_name, attribution=("GBIF.org" if source_name.startswith("GBIF") else "iNaturalist.org")+
        " (aggregated records; source authorship retained on the originating platform)",
        sourceUrl=source_url,
        geographicSource=MAP_SOURCE,
        geographicAuthor=MAP_AUTHOR,
        geographicLicenseUrl=MAP_LICENSE_URL,
        bounds=GEO, gridSize=dict(latitudeDegrees=GRID_LAT,longitudeDegrees=GRID_LON),
        sampledRecords=queried, matchingRecords=accepted, cells=cells[:140],
        monthEvidenceMinRecords=3, monthEvidenceMinDays=2, geographicProjection="equirectangular",
        filteredCells=len(cells), speciesWithCells=len({s["id"] for c in cells for s in c["species"]}),
        note="Ограниченная выборка открытых наблюдений, сгруппированная в крупные зоны; не карта гнёзд, не точное место и не прогноз.",
        rejections=dict(rejected),
    )

def main():
    APP.mkdir(parents=True,exist_ok=True)
    write_map()
    try:
        data=scan()
    except (requests.RequestException,ValueError,RuntimeError) as exc:
        print("GBIF sample unavailable: "+str(exc))
        data=dict(generated=TODAY,source="GBIF occurrence/search",bounds=GEO,cells=[],
                  sampledRecords=0,matchingRecords=0,filteredCells=0,speciesWithCells=0,
                  geographicSource=MAP_SOURCE, geographicAuthor=MAP_AUTHOR,
                  note="Нет проверенной выборки наблюдений. Точки не нарисованы искусственно.")
    (APP/"habitat-data.js").write_text("window.HABITAT_DATA="+json.dumps(data,ensure_ascii=False,separators=(",",":"))+";\n",encoding="utf8")
    print("Habitat: cells",len(data["cells"]),"species",data.get("speciesWithCells"),"query sample",data.get("sampledRecords"))

if __name__=="__main__":
    main()
