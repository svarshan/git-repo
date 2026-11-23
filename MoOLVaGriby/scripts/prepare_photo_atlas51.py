#!/usr/bin/env python3
"""Bundle the selected open photos and preserve the release's source attributions."""

import argparse
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
import json
from pathlib import Path
import re
import time
from urllib.request import Request, urlopen

from PIL import Image, ImageOps

LICENSES = {"CC0", "CC-BY", "CC-BY-SA"}
VIEWS = {"top", "side", "underside", "details", "general"}
INAT_HOST = "https://inaturalist-open-data.s3.amazonaws.com/photos/"
HEADERS = {
    "User-Agent": "MoOLVaGriby/5.1 (offline photo atlas; https://github.com/svarshan/git-repo)"
}
MAX_BYTES = 6_000_000
COMMONS_URL = re.compile(
    r"https://upload\.wikimedia\.org/wikipedia/commons/[0-9a-f]/[0-9a-f]{2}/[A-Za-z0-9_.,%()!-]+\.(?:jpg|jpeg)",
    re.IGNORECASE,
)
COMMONS_LICENSE = re.compile(r"CC (?:BY|BY-SA) [1-4]\.0|CC0(?: 1\.0)?")
TAXON_ALIASES = {"Lactarius necator": "Lactarius turpis"}


def read_js(path):
    return json.loads(path.read_text(encoding="utf-8").splitlines()[0].split("=", 1)[1].rstrip(";"))


def validate_plan(plan):
    if plan.get("schema") != 1 or not isinstance(plan.get("species"), dict):
        raise ValueError("Invalid photo manifest")
    seen = set()
    for latin, records in plan["species"].items():
        if not re.fullmatch(r"[A-Z][a-z-]+ [a-z-]+", latin) or not 0 <= len(records) <= 5:
            raise ValueError(f"Invalid photo manifest row: {latin}")
        for row in records:
            if (row["view"] not in VIEWS
                    or row["basis"] not in {"visual-estimate", "source-caption", "reviewed", "unclassified"}):
                raise ValueError(f"Invalid photo view: {row}")
            if "legacy" in row:
                if not re.fullmatch(r"media/(?:photos|gallery)/[A-Za-z0-9_-]+\.jpg", row["legacy"]):
                    raise ValueError(f"Invalid legacy path: {row}")
            elif "commons" in row:
                key = asset_key(row)
                if (type(row["commons"]) is not int or row["commons"] <= 0 or key in seen
                        or not COMMONS_URL.fullmatch(row["url"])
                        or not re.fullmatch(r"https://commons\.wikimedia\.org/wiki/File:[^?#\s]+", row["source"])
                        or not COMMONS_LICENSE.fullmatch(row["license"])
                        or not 0 < len(row["author"]) <= 240):
                    raise ValueError(f"Invalid Commons photo: {latin}")
                seen.add(key)
            else:
                photo_id = row["id"]
                key = asset_key(row)
                if (type(photo_id) is not int or photo_id <= 0 or key in seen
                        or row["ext"] not in {"jpg", "jpeg", "png", "webp"}
                        or row["license"] not in LICENSES or not 0 < len(row["author"]) <= 240
                        or ("taxon" in row and TAXON_ALIASES.get(latin) != row["taxon"])):
                    raise ValueError(f"Invalid iNaturalist photo: {latin}")
                seen.add(key)


def asset_key(row):
    if "commons" in row:
        return f"commons-{row['commons']}"
    return f"inat-{row['id']}"


def import_photo(row, root, local_source):
    key = asset_key(row)
    is_commons = "commons" in row
    relative = f"media/gallery/{key}.jpg"
    file = root / relative
    source = row["source"] if is_commons else f"https://www.inaturalist.org/photos/{row['id']}"
    if not file.exists():
        if local_source:
            name = key if is_commons else str(row["id"])
            file.write_bytes((local_source / f"{name}.jpg").read_bytes())
        else:
            url = row["url"] if is_commons else f"{INAT_HOST}{row['id']}/medium.{row['ext']}"
            for attempt in range(4):
                try:
                    with urlopen(Request(url, headers=HEADERS), timeout=20) as response:
                        raw = response.read(MAX_BYTES + 1)
                    if len(raw) > MAX_BYTES:
                        raise ValueError("Photo exceeds size limit")
                    with Image.open(BytesIO(raw)) as img:
                        if img.format not in {"JPEG", "PNG", "WEBP"} or min(img.size)<170:
                            raise ValueError("Unsupported or undersized photo")
                        photo = ImageOps.exif_transpose(img).convert("RGB")
                        photo.thumbnail((680, 680))
                        photo.save(file, quality=83, optimize=True)
                    break
                except (OSError, ValueError) as exc:
                    if attempt == 3:
                        raise RuntimeError(f"Cannot download photo {key}") from exc
                    time.sleep(1 + attempt * 2)
    return {"file": relative, "source": source,
            **({"sourceTaxon": row["taxon"]} if "taxon" in row else {}),
            "author": row["author"], "license": row["license"], "view": row["view"],
            "viewBasis": row["basis"], "modified": "Уменьшен размер, перекодирован в JPEG"}


def prepare(root, plan, local_source):
    validate_plan(plan)
    previous = read_js(root / "photos.js")
    gallery = read_js(root / "photos-gallery20.js")
    old_files = {
        latin: {entry["file"]: entry for entry in [previous.get(latin), *gallery.get(latin, [])] if entry}
        for latin in previous.keys() | gallery.keys()
    }
    (root / "media/gallery").mkdir(parents=True, exist_ok=True)
    assets = {}
    photos = [
        row for records in plan["species"].values() for row in records if "legacy" not in row
    ]
    with ThreadPoolExecutor(max_workers=12) as downloads:
        for row, photo in zip(photos, downloads.map(lambda row: import_photo(row, root, local_source), photos)):
            assets[asset_key(row)] = photo
    all_photos = {}
    for latin, records in plan["species"].items():
        photos = []
        if old_files.get(latin) and not records:
            raise RuntimeError(f"Photo cover regression: {latin}")
        for row in records:
            if "legacy" in row:
                entry = old_files.get(latin, {}).get(row["legacy"])
                if not entry or not (root / row["legacy"]).is_file():
                    raise RuntimeError(f"Missing previously attributed photo: {row['legacy']}")
                photos.append({**entry, "view": row["view"], "viewBasis": row["basis"]})
            else:
                photos.append(assets[asset_key(row)])
        all_photos[latin] = photos
    views = lambda photos: sorted({p["view"] for p in photos if p["view"] != "general"})
    report = {
        "schema": 1, "catalogSpecies": len(all_photos),
        "previouslyWithCover": sum(latin in previous for latin in all_photos),
        "previouslyWithPhotos": sum(latin in previous or bool(gallery.get(latin)) for latin in all_photos),
        "speciesWithPhotos": sum(bool(p) for p in all_photos.values()),
        "speciesWithMultiplePhotos": sum(len(p) > 1 for p in all_photos.values()),
        "speciesWithThreePhotos": sum(len(p) >= 3 for p in all_photos.values()),
        "speciesWithDifferentViews": sum(len(views(p)) >= 2 for p in all_photos.values()),
        "speciesWithUnderside": sum("underside" in views(p) for p in all_photos.values()),
        "photos": sum(map(len, all_photos.values())),
        "newPhotos": len(assets),
        "viewLabels": {"visual-estimate": "Ориентировочно", "source-caption": "По подписи автора",
                       "reviewed": "Просмотрен", "unclassified": "Ракурс не указан"},
        "species": [
            {"latin": latin, "count": len(p), "views": views(p),
             "photos": [
                 {"source": x["source"], "author": x["author"], "license": x["license"],
                  "view": x["view"], "basis": x["viewBasis"],
                  **({"sourceTaxon": x["sourceTaxon"]} if "sourceTaxon" in x else {})}
                 for x in p
             ]}
            for latin, p in all_photos.items()
        ]
    }
    if report["speciesWithPhotos"] < report["previouslyWithPhotos"]:
        raise RuntimeError("Photo cover regression")
    (root / "photos-atlas51.js").write_text(
        "window.MOOLVA_ATLAS_PHOTOS51=" + json.dumps(all_photos, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8")
    (root / "photo-atlas51-report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False)+"\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in report.items() if key != "species"}, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("bundle", type=Path)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--local-source", type=Path)
    args = parser.parse_args()
    prepare(args.bundle, json.loads(args.manifest.read_text(encoding="utf-8")), args.local_source)
