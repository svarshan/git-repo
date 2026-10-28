import hashlib,json,os,pathlib,subprocess,sys,tempfile,wave
import numpy as np
import torch
ROOT=pathlib.Path(__file__).resolve().parent
data=json.loads((ROOT/'segments.json').read_text('utf-8'))
voice=sys.argv[1]
assert voice in ['baya','kseniya','xenia','aidar','eugene']
torch.set_num_threads(3)
model,_=torch.hub.load('snakers4/silero-models','silero_tts',language='ru',speaker='v5_6_ru',trust_repo=True)
model.to(torch.device('cpu'))
out=ROOT/'out'/'audio'/voice
out.mkdir(parents=True,exist_ok=True)
def key(s):return ' '.join(s.replace(chr(769),'').strip().lower().split())
errors=[]
for i,t in enumerate(data['phrases'],1):
 try:
  filename=hashlib.sha256(key(t).encode('utf-8')).hexdigest()[:32]+'.mp3'
  target=out/filename
  if target.exists() and target.stat().st_size>1300:continue
  x=model.apply_tts(text=t,speaker=voice,sample_rate=24000).detach().cpu().float().numpy().reshape(-1)
  if len(x)<1000 or not np.isfinite(x).all() or np.max(np.abs(x))<.003:raise RuntimeError('silent')
  with tempfile.TemporaryDirectory() as d:
   wavepath=pathlib.Path(d)/'speech.wav'
   with wave.open(str(wavepath),'wb') as w:
    w.setnchannels(1);w.setsampwidth(2);w.setframerate(24000)
    w.writeframes((np.clip(x,-1,1)*32767).astype('<i2').tobytes())
   subprocess.run(['ffmpeg','-loglevel','error','-nostdin','-y','-i',str(wavepath),'-ac','1','-ar','24000','-b:a','64k',str(target)],check=True,timeout=40)
   if target.stat().st_size<1300:raise RuntimeError('tiny mp3')
 except Exception as e:errors.append({'text':t,'error':str(e)})
 if i%40==0 or i==len(data['phrases']):print(voice,i,len(data['phrases']),'errors:',len(errors),flush=True)
(ROOT/'out'/f'{voice}_report.json').write_text(json.dumps({'voice':voice,'expected':len(data['phrases']),'actual':len(list(out.glob('*.mp3'))),'errors':errors},ensure_ascii=False,indent=2),encoding='utf8')
if errors:sys.exit(2)
