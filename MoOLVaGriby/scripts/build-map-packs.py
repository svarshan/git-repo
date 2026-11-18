"""Build the offline overview and separate downloadable map packs."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

APP = Path(__file__).resolve().parents[1]
SOURCE = 'https://build.protomaps.com/20261116.pmtiles'
COVERAGE = '41.55,54.38,47.85,58.22'


def extract(pmtiles, source, output, zoom, bounds=None, minzoom=None):
    args = [pmtiles, 'extract', str(source), str(output), '--quiet', f'--maxzoom={zoom}']
    if bounds is not None:
        args.append('--bbox=' + bounds)
    if minzoom is not None:
        args.append(f'--minzoom={minzoom}')
    subprocess.run(args, check=True)
    subprocess.run([pmtiles, 'verify', str(output)], check=True)


def build(pmtiles, seed, details, overview):
    details.mkdir(parents=True, exist_ok=True)
    overview.parent.mkdir(parents=True, exist_ok=True)
    extract(pmtiles, seed, overview, 8)
    regions = json.loads((APP / 'map-regions.json').read_text(encoding='utf-8'))
    for region in regions:
        archive = details / (region['id'] + '.pmtiles')
        extract(pmtiles, seed, archive, 14, ','.join(map(str, region['bounds'])))
        with archive.open('rb') as source:
            region['sha256'] = hashlib.file_digest(source, 'sha256').hexdigest()
        region['size'] = archive.stat().st_size
    (details / 'catalog.json').write_text(json.dumps(regions, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    (details / 'ATTRIBUTION.txt').write_text(
        'Map data © OpenStreetMap contributors https://www.openstreetmap.org/copyright\n'
        'Protomaps Basemap, ODbL 1.0 Produced Work https://docs.protomaps.com/basemaps/downloads\n'
        f'Source archive: {SOURCE}\n', encoding='utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pmtiles', required=True)
    parser.add_argument('--seed', required=True, type=Path)
    parser.add_argument('--details', required=True, type=Path)
    parser.add_argument('--overview', required=True, type=Path)
    options = parser.parse_args()
    if not options.seed.exists():
        options.seed.parent.mkdir(parents=True, exist_ok=True)
        extract(options.pmtiles, SOURCE, options.seed, 14, COVERAGE, 5)
    build(options.pmtiles, options.seed, options.details, options.overview)
