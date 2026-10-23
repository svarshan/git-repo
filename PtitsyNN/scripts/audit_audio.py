#!/usr/bin/env python3
"""Technical QA of bird sound files. Does not verify a species by listening or detect speech.
Produces JSON and CSV reports; rejects corrupt, very quiet and cross-species duplicated audio.
"""
from pathlib import Path
import csv,hashlib,json,re,subprocess
import imageio_ffmpeg
ROOT=Path(__file__).resolve().parents[1]
APP=ROOT/'app'
DATA=ROOT/'data'
FILE=APP/'data.js'
FF=imageio_ffmpeg.get_ffmpeg_exe()
def metric(pattern,txt):
 m=re.search(pattern,txt)
 return float(m.group(1)) if m else None
def inspect(path):
 args=[FF,'-nostdin','-hide_banner','-i',str(path),'-t','35',
       '-af','volumedetect,silencedetect=noise=-45dB:d=0.4','-vn','-f','null','-']
 r=subprocess.run(args,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,timeout=45)
 log=r.stderr.decode('utf8','replace')
 if r.returncode!=0:raise ValueError('Cannot decode recording')
 d=re.search(r'Duration:\s*(\d+):(\d+):([\d.]+)',log)
 duration=(int(d.group(1))*3600+int(d.group(2))*60+float(d.group(3))) if d else None
 mean=metric(r'mean_volume:\s*(-?[\d.]+)\s*dB',log)
 peak=metric(r'max_volume:\s*(-?[\d.]+)\s*dB',log)
 silence=sum(float(x) for x in re.findall(r'silence_duration:\s*([\d.]+)',log))
 fraction=min(1.,silence/max(.001,min(duration or 35,35)))
 if not(duration and duration>=1 and mean is not None and peak is not None and mean>=-48 and peak>=-28 and fraction<.90):
  raise ValueError('Excessive silence or insufficient audible signal')
 return {'seconds':round(duration,2),'meanDb':mean,'peakDb':peak,'silenceFraction':round(fraction,3)}
def main():
 raw=FILE.read_text('utf8').strip()
 assert raw.startswith('window.BIRDS_DATA=')
 birds=json.loads(raw[len('window.BIRDS_DATA='):].rstrip(';'))
 rows=[];hashes={}
 for b in birds:
  if not b.get('audioFile'):continue
  credit=b.get('audioCredits') or {}
  row={'latin':b['latin'],'bird':b['name'],'source':credit.get('source',''),
       'author':credit.get('author',''),'license':credit.get('license',''),
       'manualReview':'not listened to by human'}
  path=(APP/b['audioFile']).resolve()
  try:
   path.relative_to((APP/'media'/'audio').resolve())
   if not path.is_file():raise ValueError('Missing local recording')
   digest=hashlib.sha256(path.read_bytes()).hexdigest()
   if digest in hashes:raise ValueError('Duplicate recording used for '+hashes[digest])
   quality=inspect(path)
   row.update(quality);row['result']='accepted'
   credit['audioQuality']=quality
   credit['audioReview']='technical checks passed; individual listening not audited'
   hashes[digest]=b['latin']
  except (OSError,ValueError,subprocess.TimeoutExpired) as ex:
   row['result']='rejected';row['reason']=str(ex)[:140]
   b['audioFile']=None;b['audioCredits']=None
  rows.append(row)
 FILE.write_text('window.BIRDS_DATA='+json.dumps(birds,ensure_ascii=False,separators=(',',':'))+';',encoding='utf8')
 DATA.mkdir(exist_ok=True)
 keys=['latin','bird','result','reason','source','license','author','seconds','meanDb','peakDb','silenceFraction','manualReview']
 with (DATA/'audio-audit.csv').open('w',encoding='utf-8-sig',newline='') as f:
  w=csv.DictWriter(f,fieldnames=keys,extrasaction='ignore')
  w.writeheader();w.writerows(rows)
 (DATA/'audio-audit.json').write_text(json.dumps({'records':rows},ensure_ascii=False,indent=2),encoding='utf8')
 coverage=DATA/'coverage.json'
 report=json.loads(coverage.read_text('utf8'))
 report['birdCalls']=sum(bool(b.get('audioFile')) for b in birds)
 report['missingAudio']=[b['latin'] for b in birds if not b.get('audioFile')]
 report['audioTechnicalAccepted']=sum(r.get('result')=='accepted' for r in rows)
 report['audioTechnicalRejected']=sum(r.get('result')=='rejected' for r in rows)
 report['audioHumanReviewed']=0
 coverage.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
 print('AUDIO QA',json.dumps({k:report[k] for k in ('audioTechnicalAccepted','audioTechnicalRejected','audioHumanReviewed')},ensure_ascii=False),flush=True)
if __name__=='__main__':main()
