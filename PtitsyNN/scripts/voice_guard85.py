#!/usr/bin/env python3
"""Fail closed if any of the 265 historical species or source bytes is lost."""
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]

def verify(app, baseline):
    raw = (app / 'data.js').read_text(encoding='utf-8').strip()
    prefix = 'window.BIRDS_DATA='
    if not raw.startswith(prefix):
        raise ValueError('Invalid catalog')
    birds = json.loads(raw[len(prefix):].rstrip(';'))
    by_name = {b['latin']: b for b in birds}
    if len(birds) != 298 or len(by_name) != 298:
        raise ValueError('Expected 298 distinct catalog species')
    rows = baseline['records']
    if len(rows) != 265 or len({r['latin'] for r in rows}) != 265:
        raise ValueError('8.4 baseline must contain 265 distinct species')
    errors = []
    for item in rows:
        bird = by_name.get(item['latin'])
        if not bird or not bird.get('audioFile'):
            errors.append(item['latin'] + ': active recording missing')
        elif not (bird.get('audioCredits') or {}).get('source') or not (bird.get('audioCredits') or {}).get('license'):
            errors.append(item['latin'] + ': active recording lacks source or license')
        try:
            path = (app / item['file']).resolve()
            path.relative_to((app / 'media' / 'audio').resolve())
            if hashlib.sha256(path.read_bytes()).hexdigest() != item['sha256']:
                errors.append(item['latin'] + ': 8.4 backup hash mismatch')
        except (ValueError, OSError):
            errors.append(item['latin'] + ': 8.4 backup file missing or invalid')
        if bird and bird.get('audioFile'):
            try:
                active = (app / bird['audioFile']).resolve()
                active.relative_to((app / 'media' / 'audio').resolve())
                if not active.is_file():
                    errors.append(item['latin'] + ': active file missing')
            except ValueError:
                errors.append(item['latin'] + ': invalid active file path')
    if errors:
        raise ValueError('8.4 voice regression:\n' + '\n'.join(errors))
    return {'baseline_species': len(rows), 'preserved': len(rows), 'all_species': len(birds)}

if __name__ == '__main__':
    try:
        result = verify(ROOT / 'app', json.loads((ROOT / 'data' / 'voice-baseline85.json').read_text(encoding='utf-8')))
        print(json.dumps(result, ensure_ascii=False))
    except (ValueError, KeyError, OSError) as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
