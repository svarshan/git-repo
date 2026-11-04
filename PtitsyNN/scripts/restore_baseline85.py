#!/usr/bin/env python3
"""Restore archived 8.4 audio bytes and any missing primary catalog entries."""
import hashlib
import json
from pathlib import Path
import shutil
import sys
from urllib.parse import urlparse
from voice_guard85 import verify

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / 'app'
PREFIX = 'window.BIRDS_DATA='

def load(app):
    raw = (app / 'data.js').read_text(encoding='utf-8').strip()
    if not raw.startswith(PREFIX):
        raise ValueError('Invalid catalog')
    return json.loads(raw[len(PREFIX):].rstrip(';'))

def valid_cached_addition(app, bird, original):
    """Keep previously incorporated calls only with valid licensing/provenance and file SHA."""
    if original.get('audioFile'):
        return False
    rel = bird.get('audioFile') or ''
    cred = bird.get('audioCredits') or {}
    if not isinstance(rel, str) or not rel.startswith('media/audio/'):
        return False
    if any(seg in ('', '.', '..') for seg in rel.split('/')):
        return False
    if cred.get('reviewStatus') != 'awaiting-user-review' or cred.get('speciesHumanVerified') is not False:
        return False
    if cred.get('sourcePlatform') not in ('Xeno-canto', 'iNaturalist', 'Wikimedia Commons', 'Tierstimmenarchiv'):
        return False
    licence = str(cred.get('licenseUrl') or cred.get('license') or '').lower()
    if not (licence.startswith('https://creativecommons.org/licenses/by/') or
            licence.startswith('https://creativecommons.org/licenses/by-sa/') or
            licence.startswith('https://creativecommons.org/publicdomain/zero/')):
        return False
    src = urlparse(str(cred.get('source') or ''))
    if src.scheme != 'https' or not src.hostname or not str(cred.get('author') or '').strip():
        return False
    target = (app / rel).resolve()
    try:
        target.relative_to((app / 'media' / 'audio').resolve())
    except ValueError:
        return False
    if not target.is_file():
        return False
    return hashlib.sha256(target.read_bytes()).hexdigest() == str(cred.get('sha256') or '')


def main(snapshot):
    oldapp = snapshot / 'app'
    baseline = json.loads((ROOT / 'data' / 'voice-baseline85.json').read_text(encoding='utf-8'))
    verify(oldapp, baseline)
    old = {b['latin']: b for b in load(oldapp)}
    current = load(APP)
    if len(current) != 298:
        raise ValueError('Current catalog is incomplete')
    for item in baseline['records']:
        src = (oldapp / item['file']).resolve()
        dst = (APP / item['file']).resolve()
        dst.relative_to((APP / 'media' / 'audio').resolve())
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
    shutil.copytree(oldapp/'media'/'audio', APP/'media'/'audio', dirs_exist_ok=True)
    restored = 0
    preserved = 0
    for bird in current:
        original = old.get(bird['latin']) or {}
        if not original:
            raise ValueError('Species not found in 8.4 baseline: '+bird['latin'])
        if valid_cached_addition(APP, bird, original):
            preserved += 1
            continue
        if bird.get('audioFile') != original.get('audioFile'):
            restored += 1
        # Preserve 265 exact archival voices, drop only invalid/incomplete additions.
        bird['audioFile'] = original.get('audioFile')
        bird['audioCredits'] = original.get('audioCredits')
        bird['audioTracks'] = original.get('audioTracks') or []
    (APP / 'data.js').write_text(PREFIX+json.dumps(current,ensure_ascii=False,separators=(',',':'))+';',encoding='utf-8')
    report_path = ROOT / 'data' / 'coverage.json'
    report = json.loads(report_path.read_text(encoding='utf-8-sig'))
    report['birdCalls'] = sum(bool(b.get('audioFile')) for b in current)
    report['missingAudio'] = [b['latin'] for b in current if not b.get('audioFile')]
    report['milestone298'] = {'target': 298, 'verifiedAudioSpecies': report['birdCalls'],
        'shortfall': 298-report['birdCalls'], 'achieved': report['birdCalls'] == 298,
        'note': 'File and attribution present; audio identity is not independently confirmed.'}
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    verify(APP, baseline)
    print('Restored 8.4 immutable files:', len(baseline['records']),
          '; invalid entries reset:', restored, '; validated newer voices kept:', preserved)

if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('Usage: restore_baseline85.py SNAPSHOT_DIR')
    main(Path(sys.argv[1]))
