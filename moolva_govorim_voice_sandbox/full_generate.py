import argparse, hashlib, json, os, subprocess, sys, tempfile, wave, pathlib
import numpy as np
import torch
ROOT=pathlib.Path(__file__).resolve().parent
CAT=json.loads((ROOT/'catalog_full.json').read_text(encoding='utf-8'))
VOICES=['baya','kseniya','xenia','aidar','eugene']
def normalized(t):
    import unicodedata,re
    return re.sub(r'\s+',' ',unicodedata.normalize('NFC',t).replace(chr(0x301),'').strip()).lower()
def corpus():
    seen=set();out=[]
    for x in CAT['items']:
        t=x['text'];k=normalized(t)
        if k not in seen:seen.add(k);out.append(t)
    for t in ['Привет! Я помогу тебе отвечать на вопросы.']+CAT.get('helper_prompts',[]):
        k=normalized(t)
        if k not in seen:seen.add(k);out.append(t)
    return out
def name(t): return hashlib.sha256(normalized(t).encode('utf-8')).hexdigest()[:32]+'.mp3'
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--voice',required=True,choices=VOICES)
    ap.add_argument('--shard',type=int,required=True)
    ap.add_argument('--shards',type=int,default=8)
    args=ap.parse_args()
    texts=corpus()
    subset=[(i,t) for i,t in enumerate(texts) if i%args.shards==args.shard]
    target=ROOT/'release_audio'/'audio'/args.voice
    target.mkdir(parents=True,exist_ok=True)
    torch.set_num_threads(min(3,os.cpu_count() or 2))
    model,_=torch.hub.load('snakers4/silero-models','silero_tts',language='ru',speaker='v5_6_ru',trust_repo=True)
    model.to(torch.device('cpu'))
    results=[];errors=[]
    for j,(i,t) in enumerate(subset,1):
        dst=target/name(t)
        try:
            if dst.exists() and dst.stat().st_size>1200:
                results.append({'index':i,'text':t,'file':str(dst.relative_to(ROOT/'release_audio'))});continue
            sound=model.apply_tts(text=normalized(t).replace('ё','ё'),speaker=args.voice,sample_rate=24000)
            data=sound.detach().cpu().float().numpy().reshape(-1)
            if not len(data) or not np.isfinite(data).all() or float(np.max(np.abs(data)))<.003:raise RuntimeError('silent/invalid audio')
            with tempfile.TemporaryDirectory() as tmp:
                source=pathlib.Path(tmp)/'clip.wav'
                with wave.open(str(source),'wb') as w:
                    w.setnchannels(1);w.setsampwidth(2);w.setframerate(24000)
                    w.writeframes((np.clip(data,-1,1)*32767).astype('<i2').tobytes())
                temp=dst.with_suffix('.tmp.mp3')
                subprocess.run(['ffmpeg','-nostdin','-loglevel','error','-y','-i',str(source),'-vn','-ac','1','-ar','24000','-b:a','64k',str(temp)],check=True,timeout=40)
                if temp.stat().st_size<1200:raise RuntimeError('invalid MP3 size')
                temp.rename(dst)
            results.append({'index':i,'text':t,'file':str(dst.relative_to(ROOT/'release_audio'))})
        except Exception as e:
            errors.append({'index':i,'voice':args.voice,'text':t,'error':str(e)})
        if j%25==0 or j==len(subset):print(f'{args.voice} shard {args.shard}: {j}/{len(subset)}, good={len(results)}, failures={len(errors)}',flush=True)
    info={'voice':args.voice,'shard':args.shard,'shards':args.shards,'total_requested':len(subset),'generated':len(results),'errors':errors}
    (ROOT/'release_audio'/f'report_{args.voice}_{args.shard}.json').write_text(json.dumps(info,ensure_ascii=False,indent=2),encoding='utf8')
    if errors:sys.exit(2)
if __name__=='__main__': main()
