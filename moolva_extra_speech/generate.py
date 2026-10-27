import hashlib,json,os,pathlib,re,subprocess,sys,tempfile,wave
import numpy as np
import torch
ROOT=pathlib.Path(__file__).resolve().parent
DATA=json.loads((ROOT/'extra_phrases.json').read_text('utf8'))['items']
VOICES=['baya','kseniya','xenia','aidar','eugene']
voice=os.environ.get('MOO_VOICE','baya')
if voice not in VOICES:raise ValueError('bad voice')
target=ROOT/'output'/'audio'/voice;target.mkdir(parents=True,exist_ok=True)
norm=lambda x:re.sub(r'\s+',' ',x.replace(chr(0x301),'').strip()).lower()
names={norm(s):s for s in DATA}
torch.set_num_threads(3)
model,_=torch.hub.load('snakers4/silero-models','silero_tts',language='ru',speaker='v5_6_ru',trust_repo=True,skip_validation=True)
model.to(torch.device('cpu'))
bad=[]
for i,(key,utterance) in enumerate(names.items(),1):
 dest=target/(hashlib.sha256(key.encode('utf8')).hexdigest()[:32]+'.mp3')
 try:
  a=model.apply_tts(text=utterance,speaker=voice,sample_rate=24000)
  data=np.asarray(a.detach().cpu(),dtype=np.float32).reshape(-1)
  if len(data)<3500 or not np.isfinite(data).all() or np.max(np.abs(data))<0.004:raise ValueError('empty or corrupt audio')
  with tempfile.TemporaryDirectory() as td:
   wavfile=pathlib.Path(td)/'in.wav'
   with wave.open(str(wavfile),'wb') as w:
    w.setnchannels(1);w.setsampwidth(2);w.setframerate(24000)
    w.writeframes((np.clip(data,-1,1)*32767).astype('<i2').tobytes())
   subprocess.run(['ffmpeg','-nostdin','-loglevel','error','-y','-i',str(wavfile),'-vn','-b:a','64k',str(dest)],check=True,timeout=40)
  if dest.stat().st_size<1500:raise RuntimeError('invalid MP3 size')
 except Exception as e:
  print('ERROR',voice,utterance,e,flush=True);bad.append({'text':utterance,'error':str(e)})
 if i%20==0:print('progress',voice,i,len(names),flush=True)
report={'voice':voice,'requested':len(names),'available':len(list(target.glob('*.mp3'))),'errors':bad}
(ROOT/'output'/f'report_{voice}.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
if bad:sys.exit(2)
print('SUCCESS',voice,len(names),flush=True)
