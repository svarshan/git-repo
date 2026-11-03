#!/usr/bin/env python3
"""Create optional conservative derivatives; never overwrite the prior recording."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

try:
    import imageio_ffmpeg
    FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
except ImportError:
    FFMPEG = 'ffmpeg'

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / 'app'
PREFIX = 'window.BIRDS_DATA='

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def make(bird):
    rel = bird.get('audioFile')
    if not rel:
        return None
    source = (APP / rel).resolve()
    source.relative_to((APP / 'media' / 'audio').resolve())
    source_hash = sha(source)
    # File identity includes source hash, so a later source change cannot silently reuse a stale derivative.
    name = source.stem + '-clean85-' + source_hash[:12] + '.mp3'
    dest = source.parent / name
    tmp = source.parent / (name + '.tmp.mp3')
    probe = subprocess.run([FFMPEG, '-nostdin', '-hide_banner', '-i', str(source), '-af',
        'silencedetect=noise=-50dB:d=1.5', '-f', 'null', '-'], stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE, timeout=120)
    if probe.returncode:
        raise ValueError('silence scan failed: ' + bird['latin'])
    log = probe.stderr.decode('utf-8', 'replace')
    duration_match = re.search(r'Duration:\s*(\d+):(\d+):([\d.]+)', log)
    if not duration_match:
        raise ValueError('duration unavailable: ' + bird['latin'])
    h, m, s = duration_match.groups()
    duration = int(h)*3600 + int(m)*60 + float(s)
    starts = [float(x) for x in re.findall(r'silence_start:\s*([\d.]+)', log)]
    ends = [float(x) for x in re.findall(r'silence_end:\s*([\d.]+)', log)]
    start, end = 0.0, duration
    if starts and ends and starts[0] < .1 and ends[0] >= 1.5:
        start = min(8.0, max(0.0, ends[0] - .5))
    if starts and starts[-1] > start and duration - starts[-1] >= 1.5 and (not ends or starts[-1] > ends[-1]):
        end = max(duration - 8.0, min(duration, starts[-1] + .5))
    # Reject trimming that would remove the majority of a recording.
    if end - start < max(1.0, duration * .5):
        start, end = 0.0, duration
    args = [FFMPEG, '-nostdin', '-v', 'error', '-y', '-ss', str(start), '-i', str(source),
        '-t', str(end-start), '-vn', '-af', 'highpass=f=70,afftdn=nr=6:nf=-35,loudnorm=I=-18:TP=-2:LRA=11',
        '-codec:a', 'libmp3lame', '-q:a', '4', str(tmp)]
    try:
        result = subprocess.run(args, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=180)
        if result.returncode or not tmp.is_file() or tmp.stat().st_size < 3000:
            raise ValueError('derivative failed: '+bird['latin']+' '+result.stderr.decode('utf-8', 'replace')[-300:])
        if sha(source) != source_hash:
            raise ValueError('source changed during processing: '+bird['latin'])
        tmp.replace(dest)
    finally:
        tmp.unlink(missing_ok=True)
    return {'latin':bird['latin'], 'input':rel, 'inputSha256':source_hash,
            'clean':'media/audio/'+name, 'cleanSha256':sha(dest),
            'trimStartSeconds':round(start,3), 'trimEndSeconds':round(duration-end,3),
            'processing':'70 Hz high-pass, gentle afftdn, loudnorm -18 LUFS/-2 dBTP; audition needed'}

def main():
    data = APP / 'data.js'
    text = data.read_text(encoding='utf-8').strip()
    if not text.startswith(PREFIX):
        raise ValueError('Invalid catalog')
    birds = json.loads(text[len(PREFIX):].rstrip(';'))
    if len(birds) != 298:
        raise ValueError('Invalid species count')
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        records = list(pool.map(make, birds))
    for leftover in (APP / 'media' / 'audio').glob('*-clean85-*.mp3.tmp.mp3'):
        leftover.unlink(missing_ok=True)
    records = [r for r in records if r]
    by_name = {r['latin']:r for r in records}
    for b in birds:
        if b['latin'] in by_name:
            b['audioCleanFile85'] = by_name[b['latin']]['clean']
    output = ROOT / 'dist' / 'release-evidence'
    output.mkdir(parents=True, exist_ok=True)
    (output / 'clean-variants85.json').write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding='utf-8')
    tmp = data.with_suffix('.js.tmp')
    tmp.write_text(PREFIX+json.dumps(birds,ensure_ascii=False,separators=(',',':'))+';', encoding='utf-8')
    tmp.replace(data)
    print('Prepared optional derivatives:', len(records), '; require listening review.')

if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print('Clean preparation failed:', exc, file=sys.stderr)
        sys.exit(1)
