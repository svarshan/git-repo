import hashlib,json,os,pathlib,subprocess,sys,tempfile,wave
import numpy as np
import torch
R=pathlib.Path(__file__).resolve().parent
D=json.loads((R/'narratives.json').read_text('utf-8'))
D=[r for r in D if r['kind']=='number' and r['number']==0 and r['item'] in ['груша','машинка']]
voices=['baya','kseniya','xenia','aidar','eugene']
voice=sys.argv[1] if len(sys.argv)>1 else 'baya'
if voice not in voices:raise ValueError('Invalid voice')
torch.set_num_threads(3)
model,_=torch.hub.load('snakers4/silero-models','silero_tts',language='ru',speaker='v5_6_ru',trust_repo=True)
model.to(torch.device('cpu'))
out=R/'out'/voice
out.mkdir(parents=True,exist_ok=True)
def normal(t):return ' '.join(t.replace(chr(0x301),'').strip().lower().split())
errors=[]
for i,record in enumerate(D,1):
    t=record['text']
    name=hashlib.sha256(normal(t).encode('utf-8')).hexdigest()[:32]+'.mp3'
    dst=out/name
    try:
        if dst.exists() and dst.stat().st_size>1400:continue
        audio=model.apply_tts(text=t,speaker=voice,sample_rate=24000)
        samples=np.asarray(audio.detach().cpu(),dtype=np.float32).reshape(-1)
        if len(samples)<1000 or not np.isfinite(samples).all() or np.max(abs(samples))<0.003:raise RuntimeError('Invalid silent audio')
        with tempfile.TemporaryDirectory() as tmp:
            src=pathlib.Path(tmp)/'v.wav'
            with wave.open(str(src),'wb') as wf:
                wf.setnchannels(1);wf.setsampwidth(2);wf.setframerate(24000)
                wf.writeframes((np.clip(samples,-1,1)*32767).astype('<i2').tobytes())
            subprocess.run(['ffmpeg','-nostdin','-loglevel','error','-y','-i',str(src),'-ac','1','-b:a','64k',str(dst)],check=True,timeout=30)
            if dst.stat().st_size<1400:raise RuntimeError('Tiny MP3')
    except Exception as e:errors.append({'index':i,'text':t,'error':str(e)})
    if i%30==0 or i==len(D):print(f'{voice}: {i}/{len(D)}, failures={len(errors)}',flush=True)
(R/'out'/f'{voice}_status.json').write_text(json.dumps({'voice':voice,'expected':len(D),'present':len(list(out.glob('*.mp3'))),'errors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
if errors:sys.exit(2)
