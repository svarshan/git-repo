#!/usr/bin/env python3
"""Find exact-taxon, media-licensed candidates. Never promotes or labels them verified."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import time
import requests

from audio_audit85 import read_catalog

ROOT = Path(__file__).resolve().parents[1]
ALLOWED = {'cc0', 'cc-by', 'cc-by-sa'}

def search(bird):
    latin = bird['latin']
    try:
        response = requests.get('https://api.inaturalist.org/v1/observations', params={
            'taxon_name': latin, 'sounds': 'true', 'sound_license': 'cc0,cc-by,cc-by-sa',
            'quality_grade': 'research', 'per_page': 20},
            headers={'User-Agent':'MoOLVaBirdAtlas/8.5 (+https://github.com/svarshan/git-repo)'}, timeout=(8, 20))
        response.raise_for_status()
        candidates = []
        for obs in response.json().get('results', []):
            if str((obs.get('taxon') or {}).get('name', '')).casefold() != latin.casefold():
                continue
            if obs.get('quality_grade') != 'research' or obs.get('captive') is True:
                continue
            for sound in obs.get('sounds', []):
                code = str(sound.get('license_code') or '').lower()
                source = sound.get('file_url') or ''
                author = sound.get('attribution') or (obs.get('user') or {}).get('login') or ''
                if code not in ALLOWED or not source.startswith('https://') or not author:
                    continue
                candidates.append({'observation': 'https://www.inaturalist.org/observations/' + str(obs['id']),
                    'sound_id': sound.get('id'), 'download_url': source, 'author': author,
                    'license': code, 'note': 'Exact observation taxon and sound license only; not listened to or verified.'})
        return {'latin': latin, 'candidates': candidates, 'status': 'found_unreviewed' if candidates else 'none_found'}
    except (requests.RequestException, ValueError, KeyError) as exc:
        return {'latin': latin, 'candidates': [], 'status': 'search_error', 'error': str(exc)[:300]}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--app', type=Path, default=ROOT/'app')
    ap.add_argument('--output', type=Path, default=ROOT/'dist'/'release-evidence'/'voice-candidates85.json')
    args = ap.parse_args()
    birds = [b for b in read_catalog(args.app) if not b.get('audioFile')]
    # Rate-limit requests and keep per-species errors distinct from a negative result.
    results = []
    for bird in birds:
        result = search(bird); results.append(result)
        print(result['latin'], result['status'], len(result['candidates']), flush=True)
        time.sleep(1.2)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps({'scope': 'metadata candidates only; no audio identity verification', 'results': results}, ensure_ascii=False, indent=2), encoding='utf-8')

if __name__ == '__main__':
    main()
