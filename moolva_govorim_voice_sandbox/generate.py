# Isolated build for MoOLVa: actual Silero v5_6_ru audio, no fake TTS.
import base64, html, json, pathlib, subprocess, tempfile, wave
import numpy as np
import torch

ROOT=pathlib.Path(__file__).parent
OUT=ROOT/"output"
OUT.mkdir(exist_ok=True)
VOICES=["baya","kseniya","xenia","aidar","eugene"]
PHRASES=[
"Привет! Я Финик, твой друг.",
"Давай играть и учиться говорить.",
"Посмотри! Это собака.",
"Повтори за мной: собака.",
"А вот машина. Машина едет по дороге.",
"Кот спит, а заяц прыгает.",
"Где спрятался мяч? Под столом!",
"Один мяч. А здесь много мячей.",
"Этот слон большой, а мышка маленькая.",
"Послушай слово: лиса. Ли-са.",
"Что случилось сначала? А что было потом?",
"Молодец! Мне нравится, как ты стараешься!"
]
report={"model":"v5_6_ru","provider":"snakers4/silero-models","voices":VOICES,"phrase_count":len(PHRASES),"generated":{},"errors":[]}
(OUT/"report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
torch.set_num_threads(3)
model,_=torch.hub.load("snakers4/silero-models","silero_tts",language="ru",speaker="v5_6_ru",trust_repo=True)
model.to(torch.device("cpu"))
pack={}
for voice in VOICES:
    pack[voice]=[]
    for i,phrase in enumerate(PHRASES,1):
        try:
            audio=model.apply_tts(text=phrase,speaker=voice,sample_rate=24000)
            samples=np.asarray(audio.detach().cpu(),dtype=np.float32).reshape(-1)
            if len(samples)<3500 or not np.isfinite(samples).all() or np.max(np.abs(samples))<0.005:
                raise ValueError("Model returned empty/invalid audio")
            with tempfile.TemporaryDirectory() as td:
                wavfile=pathlib.Path(td)/"speech.wav"
                mp3file=pathlib.Path(td)/"speech.mp3"
                with wave.open(str(wavfile),"wb") as w:
                    w.setnchannels(1);w.setsampwidth(2);w.setframerate(24000)
                    w.writeframes((np.clip(samples,-1,1)*32767).astype("<i2").tobytes())
                subprocess.run(["ffmpeg","-nostdin","-loglevel","error","-y","-i",str(wavfile),"-ac","1","-b:a","96k",str(mp3file)],check=True)
                test=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","default=nokey=1:noprint_wrappers=1",str(mp3file)],check=True,capture_output=True,text=True)
                seconds=float(test.stdout.strip())
                if seconds<0.3 or seconds>40: raise ValueError("Unexpected audio duration")
                raw=mp3file.read_bytes()
                if len(raw)<1500:raise ValueError("MP3 too short")
                pack[voice].append("data:audio/mpeg;base64,"+base64.b64encode(raw).decode("ascii"))
                print(f"{voice} {i:02d}/12 {seconds:.1f}s {len(raw)} bytes",flush=True)
        except Exception as e:
            report["errors"].append({"voice":voice,"number":i,"error":str(e)})
            print(f"ERROR {voice} {i}: {e}",flush=True)
    report["generated"][voice]=len(pack[voice])
    (OUT/"report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
if any(len(pack[v])!=12 for v in VOICES):
    raise RuntimeError("Some Silero audio failed; refusing to output incomplete audition HTML")

data=json.dumps({"voices":pack,"phrases":PHRASES},ensure_ascii=False,separators=(",",":")).replace("</","<\\/")
page='''<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MoOLVa — пять живых голосов Silero</title><style>
:root{--ink:#25443a;--green:#427b56;--paper:#f7f8f1}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:system-ui,sans-serif}.wrap{max-width:840px;margin:auto;padding:18px}header{background:#e8efdd;padding:26px;border-radius:22px;margin:10px 0 20px}h1{font-size:clamp(23px,5vw,33px);margin:8px 0}p{line-height:1.5}label{font-weight:bold;font-size:14px}.box{background:white;border:1px solid #e3e8db;border-radius:18px;padding:18px;margin:14px 0}select,audio,button{width:100%;max-width:100%;font:inherit}select,button{min-height:45px;border:1px solid #ccd9c4;border-radius:12px;background:white;padding:10px;margin:9px 0}button{cursor:pointer;text-align:left}button:hover,button:focus-visible{background:#e8f0df;outline:2px solid var(--green)}button.active{background:#e0edd8;border-color:#79a66b}audio{margin:10px 0}.muted{color:#68796c;font-size:13px}.chip{display:inline-block;background:#e4f0dd;padding:5px 12px;border-radius:999px;font-size:12px}.list{display:grid;grid-template-columns:1fr 1fr;gap:8px}@media(max-width:560px){.list{grid-template-columns:1fr}.wrap{padding:12px}.box{padding:14px}}</style></head><body><main class="wrap"><header><div class="chip">Встроено 60 настоящих MP3 Silero</div><h1>🦊 MoOLVa · Выбираем голос Финика</h1><p>Пять разных голосов. Все фразы воспроизводятся офлайн — из этого HTML, без голосов телефона. Нажмите на нужную фразу.</p></header>
<section class="box"><label for="voice">Кого слушаем?</label><select id="voice"><option value="baya">Baya — женский</option><option value="kseniya">Kseniya — женский</option><option value="xenia">Xenia — женский</option><option value="aidar">Aidar — мужской</option><option value="eugene">Eugene — мужской</option></select><audio id="player" controls playsinline preload="none"></audio><p class="muted" id="status">Выберите фразу ниже.</p></section>
<section class="box"><h2>12 проверочных фраз</h2><div class="list" id="phrases"></div></section><section class="box"><h2>Оценка</h2><label for="vote">Выбранный голос</label><select id="vote"><option value="">Не выбран</option><option value="baya">Baya</option><option value="kseniya">Kseniya</option><option value="xenia">Xenia</option><option value="aidar">Aidar</option><option value="eugene">Eugene</option></select><p class="muted">Произношение необходимо проверить человеку: автоматическая генерация не гарантирует нормативные ударения.</p></section></main>
<script>const PACK=__PACK__;const $=s=>document.querySelector(s),voice=$("#voice"),audio=$("#player");let index=-1;
function show(){const v=voice.value;$("#phrases").innerHTML=PACK.phrases.map((s,i)=>'<button data-i="'+i+'" type="button">'+(i+1)+'. '+s.replaceAll('&','&amp;').replaceAll('<','&lt;')+'</button>').join('');$("#status").textContent="Голос "+v+": все 12 MP3 встроены. Слушайте.";if(index>=0)load(index,false)}
function load(i,play=true){index=i;audio.src=PACK.voices[voice.value][i];$("#status").textContent="Голос "+voice.value+", фраза №"+(i+1);document.querySelectorAll('[data-i]').forEach(b=>b.classList.toggle('active',Number(b.dataset.i)===i));if(play)audio.play().catch(()=>$("#status").textContent="Нажмите ▶ на плеере для запуска звука.")}
voice.addEventListener('change',show);$("#phrases").addEventListener('click',e=>{const b=e.target.closest('[data-i]');if(b)load(Number(b.dataset.i))});show();</script></body></html>'''
page=page.replace("__PACK__",data)
f=OUT/"MoOLVa_2.8_SILERO_5_GOLOSOV_REAL_OFFLINE.html"
f.write_text(page,encoding="utf-8")
print("SUCCESS",f,f.stat().st_size,flush=True)
