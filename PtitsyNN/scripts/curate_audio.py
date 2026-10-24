#!/usr/bin/env python3
"""Normalize only verified, species-specific, redistribution-permitted field recordings.
Requires imageio-ffmpeg, which supplies a portable FFmpeg binary on GitHub Windows runners.
Human conversations from general iNaturalist observations are NOT included.
"""
from pathlib import Path
import json, subprocess, tempfile, os
import imageio_ffmpeg

ROOT=Path(__file__).resolve().parents[1]
APP=ROOT/'app'
DATA=APP/'data.js'
FFMPEG=imageio_ffmpeg.get_ffmpeg_exe()

def run():
 raw=DATA.read_text(encoding='utf-8').strip()
 prefix='window.BIRDS_DATA='
 if not raw.startswith(prefix):raise ValueError('invalid data.js catalog')
 birds=json.loads(raw[len(prefix):].rstrip(';'))
 done=0
 removed=0
 for b in birds:
  media=b.get('audioFile')
  if not media:continue
  # Already-normalized current-version assets are safe to reuse without lossy re-encoding.
  if (b.get('audioCredits') or {}).get('audioProcessing') and (APP/media).is_file():
   continue
  credit=b.get('audioCredits') or {}
  source=str(credit.get('source') or '')
  if not (source.startswith('https://commons.wikimedia.org/') or
          source.startswith('https://xeno-canto.org/') or
          source.startswith('https://freesound.org/people/') or
          source.startswith('https://freesound.org/s/') or
          source.startswith('https://archive.org/details/')):
   b['audioFile']=None;b['audioCredits']=None;removed+=1;continue
  path=(APP/media).resolve()
  try:path.relative_to((APP/'media').resolve())
  except ValueError:raise ValueError('unexpected audio path '+media)
  if not path.is_file():
   b['audioFile']=None;b['audioCredits']=None;removed+=1;continue
  # Keep source file untouched until conversion succeeds and validate encoded header.
  dst=path.with_suffix('.normalized.mp3')
  try:
   cmd=[FFMPEG,'-nostdin','-hide_banner','-loglevel','error','-y','-i',str(path),
       '-t','35','-vn','-ac','1','-ar','32000',
       '-af','highpass=f=165,lowpass=f=11000,dynaudnorm=f=150:g=9:p=0.94:m=8,alimiter=limit=0.96',
       '-codec:a','libmp3lame','-qscale:a','4',str(dst)]
   p=subprocess.run(cmd,timeout=35,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
   if p.returncode!=0 or not dst.is_file() or dst.stat().st_size<3000:
    raise RuntimeError('ffmpeg failed: '+p.stderr.decode('utf-8','replace')[-250:])
   if dst.open('rb').read(3)!=b'ID3' and dst.open('rb').read(1)!=b'\xff':
    raise ValueError('Invalid MP3 header')
   target=path.with_suffix('.mp3')
   os.replace(dst,target)
   if path!=target:path.unlink(missing_ok=True)
   b['audioFile']='media/audio/'+target.name
   credit['audioProcessing']='normalized, high-pass filtered, bounded to 35 seconds'
   done+=1
  except (OSError,ValueError,RuntimeError,subprocess.TimeoutExpired) as e:
   dst.unlink(missing_ok=True)
   # Don't label broken, inaudible or unsupported files as verified voices.
   b['audioFile']=None;b['audioCredits']=None;removed+=1
   print('AUDIO REJECT',b['latin'],str(e)[:150],flush=True)
 # Do not ship old ambient conversations from previous caches as unused EXE resources.
 referenced={str((APP/b['audioFile']).resolve()) for b in birds if b.get('audioFile')}
 for b in birds:
  for t in b.get('audioTracks',[]) if isinstance(b.get('audioTracks'),list) else []:
   if isinstance(t,dict) and str(t.get('path','')).startswith('media/audio/'):
    p=(APP/t['path']).resolve()
    try:p.relative_to((APP/'media'/'audio').resolve())
    except ValueError:continue
    if p.is_file():referenced.add(str(p))
 for stale in (APP/'media'/'audio').glob('*'):
  if stale.is_file() and str(stale.resolve()) not in referenced:stale.unlink(missing_ok=True)
 DATA.write_text(prefix+json.dumps(birds,ensure_ascii=False,separators=(',',':'))+';',encoding='utf8')
 report_path=ROOT/'data'/'coverage.json'
 report=json.loads(report_path.read_text(encoding='utf8'))
 report['birdCalls']=sum(bool(b.get('audioFile')) for b in birds)
 report['missingAudio']=[b['latin'] for b in birds if not b.get('audioFile')]
 report['audioProcessed']=done
 report['audioRejected']=removed
 report['audioSources']={src:sum(bool(b.get('audioFile')) and src in (b.get('audioCredits') or {}).get('source','') for b in birds) for src in ('wikimedia.org','inaturalist.org','xeno-canto.org','freesound.org','archive.org')}
 report_path.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
 print('CURATED AUDIO',{'normalized':done,'rejected':removed,'verified_audio':report['birdCalls'],'photos':report['photos']},flush=True)

if __name__=='__main__':run()
