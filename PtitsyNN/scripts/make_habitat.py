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
MAP_URL = "https://commons.wikimedia.org/wiki/Special:Redirect/file/Nizhny_Novgorod_Oblast_(location_map).svg"
MAP_SOURCE = "https://commons.wikimedia.org/wiki/File:Nizhny_Novgorod_Oblast_(location_map).svg"
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
    destination = APP / "nn-oblast-map.svg"
    response = get(MAP_URL, timeout=40)
    content = response.content
    if not (content.lstrip().startswith(b"<?xml") or content.lstrip().startswith(b"<svg")):
        raise RuntimeError("Wikimedia returned no SVG file")
    if len(content) < 12000 or len(content) > 500000:
        raise RuntimeError("Unexpected cartographic SVG size")
    value = content.decode("utf-8")
    if not re.search(r"<svg[\s>]", value) or re.search(r"<script|<foreignObject", value, re.I):
        raise RuntimeError("Invalid or unsafe cartographic SVG")
    destination.write_text(value, encoding="utf8")
    print("Bundled official Wikimedia map, bytes",len(content))

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
    for page in range(MAX_PAGES):
        source_license,source_years=cohorts[page % len(cohorts)]
        offset=(page // len(cohorts))*LIMIT
        data=get("https://api.gbif.org/v1/occurrence/search",
                 {**qs,"license":source_license,"year":source_years,"offset":offset},timeout=30).json()
        records=data.get("results",[])
        if not isinstance(records,list):
            raise RuntimeError("Malformed GBIF occurrence data")
        queried+=len(records)
        if page == 0 and records:
            a=records[0]
            print("GBIF first record fields:",{k:a.get(k) for k in ("species","scientificName","stateProvince","gadm","license","year","coordinateUncertaintyInMeters","issues")})
        for r in records:
            if not valid_region(r):
                rejected["outside_region_or_unverified_province"]+=1
                continue
            latin = name_key(r.get("species"))
            b_id = catalog_names.get(latin)
            if not b_id:
                rejected["not_catalog_species"]+=1
                continue
            if r.get("occurrenceStatus") == "ABSENT":
                rejected["absence"]+=1
                continue
            seen_licenses[str(r.get("license") or "")]+=1
            if not license_allowed(r.get("license")):
                rejected["license"]+=1
                continue
            if r.get("informationWithheld") or r.get("dataGeneralizations"):
                rejected["redacted_data"]+=1
                continue
            issues=set(r.get("issues") or ())
            if issues.intersection(EXCLUDED_ISSUES):
                rejected["geospatial"]+=1
                continue
            uncertainty=r.get("coordinateUncertaintyInMeters")
            if uncertainty and float(uncertainty)>5000:
                rejected["imprecise"]+=1
                continue
            yr = r.get("year")
            if not isinstance(yr,int) or yr<2016 or yr>int(TODAY[:4]):
                rejected["date"]+=1
                continue
            try:
                lat=float(r["decimalLatitude"])
                lon=float(r["decimalLongitude"])
            except (TypeError, ValueError, KeyError):
                rejected["no_coords"]+=1
                continue
            if not (GEO["south"]<=lat<=GEO["north"] and GEO["west"]<=lon<=GEO["east"]):
                rejected["outside_bbox"]+=1
                continue
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
        print(f"GBIF page {page+1}: scanned {queried}; accepted {accepted}; last page {len(records)}")
        if data.get("endOfRecords") or len(records)<LIMIT:
            continue

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
        generated=TODAY, source="GBIF occurrence/search", attribution="GBIF.org (aggregated records; dataset authorship retained at source)",
        sourceUrl="https://www.gbif.org/occurrence/search?country=RU&taxon_key=212",
        geographicSource=MAP_SOURCE,
        geographicAuthor="M.Bitton / Wikimedia Commons / CC BY-SA 4.0",
        geographicLicenseUrl="https://creativecommons.org/licenses/by-sa/4.0/",
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
                  geographicSource=MAP_SOURCE, geographicAuthor="M.Bitton / Wikimedia Commons / CC BY-SA 4.0",
                  note="Нет проверенной выборки наблюдений. Точки не нарисованы искусственно.")
    (APP/"habitat-data.js").write_text("window.HABITAT_DATA="+json.dumps(data,ensure_ascii=False,separators=(",",":"))+";\n",encoding="utf8")
    print("Habitat: cells",len(data["cells"]),"species",data.get("speciesWithCells"),"query sample",data.get("sampledRecords"))

if __name__=="__main__":
    main()
