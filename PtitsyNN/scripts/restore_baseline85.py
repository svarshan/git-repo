#!/usr/bin/env python3
"""Restore archived 8.4 audio bytes and any missing primary catalog entries."""
import json
from pathlib import Path
import shutil
import sys
from voice_guard85 import verify

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / 'app'
PREFIX = 'window.BIRDS_DATA='

def load(app):
    raw = (app / 'data.js').read_text(encoding='utf-8').strip()
    if not raw.startswith(PREFIX):
        raise ValueError('Invalid catalog')
    return json.loads(raw[len(PREFIX):].rstrip(';'))

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
    for bird in current:
        original = old.get(bird['latin']) or {}
        if not original:
            raise ValueError('Species not found in 8.4 baseline: '+bird['latin'])
        if bird.get('audioFile') != original.get('audioFile'):
            restored += 1
        # Preserve the exact last successful catalog. New candidates remain out of
        # the public player until their audio has been reviewed by a person.
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
    print('Restored 8.4 immutable files:', len(baseline['records']), '; active species recovered:', restored)

if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('Usage: restore_baseline85.py SNAPSHOT_DIR')
    main(Path(sys.argv[1]))
