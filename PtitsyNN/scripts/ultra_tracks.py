#!/usr/bin/env python3
"""MoOLVa 2.7 ULTRA: multiple species-specific permitted recordings.

Run AFTER primary FFmpeg curation + audio audit. Existing good primary files
remain untouched. Every extra gets its own individual license and author,
FFmpeg normalization and independent loudness/duplicate check.
Automatic QA does NOT certify ornithological identity or absence of speech.
"""
from concurrent.futures import ThreadPoolExecutor,as_completed
from pathlib import Path
import hashlib,json,os,re,subprocess,time
import imageio_ffmpeg
import voice_max,harvest_voices
from make_catalog import APP,ROOT,M,valid_existing_media
from audit_audio import inspect

CAT=APP/'data.js';REPORT=ROOT/'data'/'coverage.json'
FF=imageio_ffmpeg.get_ffmpeg_exe()
BUDGET_END=float('inf')
seen_hashes=set()
def stored(b):
 out=[]
 for t in b.get('audioTracks',[]) if isinstance(b.get('audioTracks'),list) else []:
  if not isinstance(t,dict) or not str(t.get('path','')).startswith('media/audio/'):continue
  p=(APP/t['path']).resolve()
  try:p.relative_to((M/'audio').resolve())
  except ValueError:continue
  if p.is_file() and p.stat().st_size>3000 and isinstance(t.get('credit'),dict):
   out.append(t)
 return out[:2]
def hashfile(p):
 digest=hashlib.sha256()
 with p.open('rb') as f:
  for data in iter(lambda:f.read(131072),b''):digest.update(data)
 return digest.hexdigest()
def choices(b):
 candidates=[]
 try:candidates.extend(voice_max.xeno_choices(b))
 except Exception as e:print('ULTRA XENO WARN',b['latin'],str(e)[:80],flush=True)
 try:candidates.extend(voice_max.commons_choices(b))
 except Exception as e:print('ULTRA COMMONS WARN',b['latin'],str(e)[:80],flush=True)
 if len(candidates)<3 and time.monotonic()<BUDGET_END:
  names=[b['latin']]+harvest_voices.SYNONYMS.get(b['latin'],[])
  for latin in names[:2]:
   for category in ('Audio files of '+latin,'Bird sounds of '+latin):
    if time.monotonic()>=BUDGET_END:break
    try:
     for url,credit,mime in harvest_voices.category(category,names,True):
      ext=harvest_voices.AUDIO.get(mime)
      if ext:
       credit['vocalization']=voice_max.soundtype(credit.get('source','')+' '+category)
       candidates.append(((1,1,0),url,ext,credit))
    except Exception as e:print('ULTRA CATEGORY WARN',latin,str(e)[:80],flush=True)
    if len(candidates)>=6:break
 unique=set();output=[]
 for _,url,ext,credit in candidates:
  if url in unique:continue
  unique.add(url);output.append((url,ext,credit))
 return output[:12]
def transcode(src,out):
 cmd=[FF,'-nostdin','-hide_banner','-loglevel','error','-y','-i',str(src),
      '-t','35','-vn','-ac','1','-ar','32000',
      '-af','highpass=f=165,lowpass=f=11000,dynaudnorm=f=150:g=9:p=0.94:m=8,alimiter=limit=0.96',
      '-codec:a','libmp3lame','-qscale:a','4',str(out)]
 result=subprocess.run(cmd,timeout=40,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
 if result.returncode or not out.is_file() or out.stat().st_size<3000:
  raise ValueError('Audio conversion failed')
 if out.open('rb').read(3)!=b'ID3' and out.open('rb').read(1)!=b'\xff':
  raise ValueError('Invalid MP3 header')
 return inspect(out)
def enrich(b):
 if time.monotonic()>=BUDGET_END:return b,0,0
 existing=stored(b)
 source_set={str((b.get('audioCredits') or {}).get('source',''))}
 source_set.update(str(t.get('credit',{}).get('source','')) for t in existing)
 added=0;rejected=0
 if len(existing)>=2:
  b['audioTracks']=existing
  return b,0,0
 for url,ext,credit in choices(b):
  if time.monotonic()>=BUDGET_END or len(existing)>=2:break
  origin=str(credit.get('source') or '')
  if not origin or origin in source_set:continue
  index=len(existing)+1
  raw=M/'audio'/(b['id']+'-ultra-'+str(index)+'.'+ext)
  target=M/'audio'/(b['id']+'-ultra-'+str(index)+'.mp3')
  temp=M/'audio'/(b['id']+'-ultra-'+str(index)+'.converted.mp3')
  try:
   if raw!=target and raw.is_file():raw.unlink()
   if not voice_max.download(url,raw):raise ValueError('Download not valid')
   quality=transcode(raw,temp)
   digest=hashfile(temp)
   if digest in seen_hashes:raise ValueError('Duplicate audio recording')
   os.replace(temp,target)
   credit['audioQuality']=quality
   credit['audioProcessing']='FFmpeg 32kHz mono, highpass/lowpass, normalized, 35s maximum'
   credit['audioReview']='license and science-name metadata plus signal QA; not human-listened'
   existing.append({'path':'media/audio/'+target.name,'credit':credit})
   source_set.add(origin);seen_hashes.add(digest);added+=1
  except (OSError,ValueError,subprocess.TimeoutExpired) as e:
   rejected+=1
   print('ULTRA RECORDING SKIP',b['latin'],str(e)[:120],flush=True)
  finally:
   for p in (raw,temp):
    if p!=target:p.unlink(missing_ok=True)
 b['audioTracks']=existing
 return b,added,rejected
def checkpoint(birds,rejected):
 CAT.write_text('window.BIRDS_DATA='+json.dumps(birds,ensure_ascii=False,separators=(',',':'))+';',encoding='utf8')
 report=json.loads(REPORT.read_text('utf8'))
 report['extraAudioTracks']=sum(len(b.get('audioTracks') or []) for b in birds)
 report['multiTrackSpecies']=sum(bool(b.get('audioTracks')) for b in birds)
 report['audioTracksTotal']=report.get('birdCalls',0)+report['extraAudioTracks']
 report['ultraExtraRejected']=rejected
 REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
 return report
def main():
 global BUDGET_END
 raw=CAT.read_text('utf8')
 if not raw.startswith('window.BIRDS_DATA='):raise RuntimeError('Invalid catalog')
 birds=json.loads(raw[len('window.BIRDS_DATA='):].rstrip('; \r\n'))
 assert len(birds)==298
 BUDGET_END=time.monotonic()+max(60,min(1000,int(os.getenv('BIRDS_ULTRA_BUDGET_SECONDS','330'))))
 voice_max.STOP=BUDGET_END
 harvest_voices.STOP=BUDGET_END
 for b in birds:
  if b.get('audioFile') and (APP/b['audioFile']).is_file():seen_hashes.add(hashfile(APP/b['audioFile']))
  for t in stored(b):seen_hashes.add(hashfile(APP/t['path']))
 todo=[i for i,b in enumerate(birds) if valid_existing_media(b,'audioFile') and len(stored(b))<2]
 rejected=0;total=0
 print('ULTRA EXTRA RECORDINGS',len(todo),'candidate birds','key configured',bool(voice_max.KEY),flush=True)
 for off in range(0,len(todo),8):
  if time.monotonic()>=BUDGET_END:break
  indexes=todo[off:off+8]
  with ThreadPoolExecutor(max_workers=4) as pool:
   tasks={pool.submit(enrich,birds[i]):i for i in indexes}
   for task in as_completed(tasks):
    i=tasks[task]
    try:birds[i],added,dropped=task.result();total+=added;rejected+=dropped
    except Exception as e:print('ULTRA WARN',birds[i]['latin'],str(e)[:150],flush=True)
  r=checkpoint(birds,rejected)
  print('ULTRA PROGRESS',off+len(indexes),'/',len(todo),'extras',r['extraAudioTracks'],flush=True)
 r=checkpoint(birds,rejected)
 print('ULTRA FINAL',json.dumps({'species':len(birds),'birdCalls':r['birdCalls'],
  'extraAudioTracks':r['extraAudioTracks'],'multiTrackSpecies':r['multiTrackSpecies'],
  'audioTracksTotal':r['audioTracksTotal'],'rejected':rejected},ensure_ascii=False),flush=True)
if __name__=='__main__':main()
