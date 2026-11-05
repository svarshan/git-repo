#!/usr/bin/env python3
"""Read-only bird audio triage. Detection flags require human review, never automatic approval."""
import argparse
import concurrent.futures
import csv
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess

import numpy as np
import webrtcvad
try:
    import imageio_ffmpeg
    DEFAULT_FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
except ImportError:
    DEFAULT_FFMPEG = 'ffmpeg'

ROOT = Path(__file__).resolve().parents[1]

def read_catalog(app):
    text = (app / 'data.js').read_text(encoding='utf-8').strip()
    prefix = 'window.BIRDS_DATA='
    if not text.startswith(prefix):
        raise ValueError('Invalid catalog')
    birds = json.loads(text[len(prefix):].rstrip(';'))
    if len(birds) != 298 or len({b['latin'] for b in birds}) != 298:
        raise ValueError('Expected 298 distinct species')
    return birds

def run(args, timeout=90):
    p = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
    if p.returncode:
        raise ValueError(p.stderr.decode('utf-8', 'replace')[-400:])
    return p.stdout

def fingerprint(samples):
    # Spectral contrast removes global gain and is resilient to lossy recoding.
    # Each 32-bit word represents relative energy in adjacent frequency bands.
    size, hop = 4096, 2048
    edges = np.unique(np.geomspace(18, size // 2, 33).astype(int))
    if len(edges) != 33:
        raise ValueError('Invalid fingerprint frequency bands')
    window = np.hanning(size)
    words = []
    for pos in range(0, min(len(samples), 16000 * 120) - size + 1, hop):
        power = np.abs(np.fft.rfft(samples[pos:pos+size] * window)) ** 2
        bands = np.array([np.mean(power[edges[i]:edges[i+1]]) for i in range(32)])
        logs = np.log(bands + 1e-14)
        bits = logs[1:] > logs[:-1]
        word = sum((1 << i) for i, value in enumerate(bits) if value)
        words.append(word)
    return tuple(words)

def analyse(app, bird, ffmpeg):
    credit = bird.get('audioCredits') or {}
    row = {'latin': bird['latin'], 'name': bird.get('name', ''), 'file': bird.get('audioFile') or '',
           'source': credit.get('source', ''), 'author': credit.get('author', ''),
           'license': credit.get('license', ''), 'human_reviewed': False, 'species_confirmed_by_audio': False,
           'speech_detection': 'not_run', 'flags': []}
    if not row['file']:
        row['flags'].append('missing_audio')
        return row, ()
    try:
        path = (app / row['file']).resolve()
        path.relative_to((app / 'media' / 'audio').resolve())
        blob = path.read_bytes()
        row['sha256'] = hashlib.sha256(blob).hexdigest()
        audio = run([ffmpeg, '-nostdin', '-v', 'error', '-i', str(path), '-vn', '-ac', '1', '-ar', '16000', '-f', 's16le', '-'])
        samples = np.frombuffer(audio, dtype='<i2').astype(np.float32) / 32768.0
        if not len(samples):
            raise ValueError('Empty audio')
        row['seconds'] = round(len(samples) / 16000, 2)
        # Measure original-bandwidth audio before the 16 kHz speech-analysis downsample;
        # high-frequency bird calls can disappear in the latter.
        volume = subprocess.run([ffmpeg, '-nostdin', '-hide_banner', '-i', str(path), '-af', 'volumedetect', '-vn', '-f', 'null', '-'],
                                stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=90)
        if volume.returncode:
            raise ValueError('Original-bandwidth volume measurement failed')
        import re
        text = volume.stderr.decode('utf-8', 'replace')
        mean = re.search(r'mean_volume:\s*(-?[\d.]+)\s*dB', text)
        peak = re.search(r'max_volume:\s*(-?[\d.]+)\s*dB', text)
        if not mean or not peak:
            raise ValueError('Volume measurements missing')
        row['rms_dbfs'] = float(mean.group(1))
        row['peak_dbfs'] = float(peak.group(1))
        row['clipped_fraction_16k_mono'] = round(float(np.mean(np.abs(samples) >= .999)), 5)
        row['quiet_fraction_16k_mono'] = round(float(np.mean(np.abs(samples) < 0.00316)), 4)
        vad = webrtcvad.Vad(2)
        frames = [audio[i:i+960] for i in range(0, len(audio)-959, 960)]
        marks = [vad.is_speech(frame, 16000) for frame in frames]
        row['speech_detection'] = 'webrtcvad_2'
        row['speech_like_fraction'] = round(sum(marks) / max(1, len(marks)), 3)
        # VAD mistakes bird calls and noise for speech. This is a review lead only.
        row['speech_like_max_seconds'] = round(max((len(s) for s in ''.join('1' if m else '0' for m in marks).split('0')), default=0) * .03, 2)
        if row['speech_like_max_seconds'] >= 1.5:
            row['flags'].append('possible_speech_review')
        if row['seconds'] < 1 or row['rms_dbfs'] < -48 or row['peak_dbfs'] < -28:
            row['flags'].append('weak_or_short_review')
        if row['clipped_fraction_16k_mono'] > .01:
            row['flags'].append('clipping_review')
        if not row['source'] or not row['author'] or not row['license']:
            row['flags'].append('missing_attribution_review')
        return row, fingerprint(samples)
    except (OSError, ValueError, subprocess.TimeoutExpired) as exc:
        row['flags'].append('decode_or_audit_error')
        row['error'] = str(exc)[:300]
        return row, ()

def near_duplicate(a, b):
    # Compare aligned spectral fingerprints; tolerate small leading offsets.
    # Requires at least ~10 s worth of fingerprint, so short sounds are not mislabelled.
    best = None
    for shift in range(-16, 17):
        aa, bb = (a[shift:], b) if shift >= 0 else (a, b[-shift:])
        n = min(len(aa), len(bb))
        if n < 70:
            continue
        distance = sum((aa[i] ^ bb[i]).bit_count() for i in range(n)) / (31 * n)
        if best is None or distance < best:
            best = distance
    return best is not None and best <= .17

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--app', type=Path, default=ROOT / 'app')
    parser.add_argument('--output', type=Path, default=ROOT / 'dist' / 'release-evidence')
    parser.add_argument('--ffmpeg', default=os.environ.get('FFMPEG', DEFAULT_FFMPEG))
    parser.add_argument('--workers', type=int, default=4)
    args = parser.parse_args()
    birds = read_catalog(args.app)
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, min(args.workers, 8))) as pool:
        out = list(pool.map(lambda b: analyse(args.app, b, args.ffmpeg), birds))
    rows = [x[0] for x in out]
    duplicate_pairs = []
    for i, (row, fp) in enumerate(out):
        if not fp:
            continue
        for other, fp2 in out[:i]:
            if fp2 and near_duplicate(fp, fp2):
                duplicate_pairs.append([other['latin'], row['latin']])
                row['flags'].append('possible_duplicate:' + other['latin'])
                other['flags'].append('possible_duplicate:' + row['latin'])
    args.output.mkdir(parents=True, exist_ok=True)
    report = {'species': len(rows), 'available': sum(bool(r['file']) for r in rows),
              'missing': sum(not r['file'] for r in rows),
              'speech_flagged': sum('possible_speech_review' in r['flags'] for r in rows),
              'audit_errors': sum('decode_or_audit_error' in r['flags'] for r in rows),
              'near_duplicate_pairs': duplicate_pairs, 'human_listened': 0,
              'note': 'VAD and fingerprints are review leads, not proof of speech, species identity, or recording authenticity.',
              'records': rows}
    (args.output / 'audio-audit85.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    fields = ['latin', 'name', 'file', 'source', 'author', 'license', 'sha256', 'seconds', 'rms_dbfs', 'peak_dbfs', 'clipped_fraction_16k_mono', 'quiet_fraction_16k_mono', 'speech_like_fraction', 'speech_like_max_seconds', 'speech_detection', 'flags', 'human_reviewed', 'species_confirmed_by_audio', 'error']
    with (args.output / 'audio-audit85.csv').open('w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction='ignore'); w.writeheader(); w.writerows(rows)
    print(json.dumps({k: v for k, v in report.items() if k != 'records'}, ensure_ascii=False))

if __name__ == '__main__':
    main()
