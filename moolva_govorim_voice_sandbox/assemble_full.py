import collections,csv,hashlib,html,json,pathlib,re,shutil,subprocess,zipfile
ROOT=pathlib.Path(__file__).resolve().parent
OUT=ROOT/'release_audio'
DEST=ROOT/'final_site'
CAT=json.loads((ROOT/'catalog_full.json').read_text('utf8'))
VOICES=['baya','kseniya','xenia','aidar','eugene']
def norm(s):return re.sub(r'\\s+',' ',s.replace(chr(0x301),'').strip()).lower()
texts=[]; seen=set()
for obj in CAT['items']:
 t=obj['text'];k=norm(t)
 if k not in seen:seen.add(k);texts.append(t)
for t in ['Привет! Я помогу тебе отвечать на вопросы.']+CAT.get('helper_prompts',[]):
 k=norm(t)
 if k not in seen:seen.add(k);texts.append(t)
slug=lambda t:hashlib.sha256(norm(t).encode('utf8')).hexdigest()[:32]+'.mp3'
status={'version':'3.0','model':'Silero v5_6_ru','voice_names':VOICES,'utterances':len(texts),'audio_expected':len(texts)*len(VOICES),'audio_present':0,'human_listening_verified':False,'missing':[]}
lookups={norm(t):slug(t) for t in texts}
for voice in VOICES:
 for t in texts:
  file=OUT/'audio'/voice/slug(t)
  if file.exists() and file.stat().st_size>1200:
   status['audio_present']+=1
  else:status['missing'].append({'voice':voice,'text':t})
(OUT/'full_release_status.json').write_text(json.dumps(status,ensure_ascii=False,indent=2),encoding='utf8')
if status['missing']:raise RuntimeError(f"Missing {len(status['missing'])} MP3: no full release")
DEST.mkdir(parents=True,exist_ok=True)
src=(ROOT/'base_app.html').read_text('utf8')
select='''<section id="silero-chooser" aria-label="Выбор голоса" style="background:#eaf0e1;border:1px solid #c9dbc0;border-radius:17px;padding:12px 16px;margin:0 0 16px">
<label for="silero-choice" style="display:block;font-size:13px;font-weight:750;margin-bottom:5px">🎧 Голос Финика и помощника</label>
<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center"><select id="silero-choice" aria-label="Выберите голос" style="flex:2;min-width:180px;background:white;border:1px solid #b8cab6;border-radius:9px;padding:8px;font-size:14px">
<option value="baya">Baya — женский</option><option value="kseniya">Kseniya — женский</option><option value="xenia">Xenia — женский</option><option value="aidar">Aidar — мужской</option><option value="eugene">Eugene — мужской</option></select>
<button id="silero-hello" type="button" class="btn primary" style="padding:8px 12px">▶ Послушать</button></div>
<div id="silero-voice-status" role="status" style="font-size:11px;margin-top:7px;color:#5d715c">Все пять голосов доступны. Для начала звука нажмите «Послушать».</div></section>'''
if '<div id="content"' not in src:raise RuntimeError("No content mount found")
src=src.replace('<div id="content"',select+'<div id="content"',1)
voice_json=json.dumps(lookups,ensure_ascii=False,separators=(',',':'))
voicejs="""\nconst SILERO_AUDIO_FILES=__LOOKUP__;\nconst SILERO_VOICE_NAMES=['baya','kseniya','xenia','aidar','eugene'];\nlet SILERO_VOICE='baya';\ntry{let saved=localStorage.getItem('moolva-silero-five-voices');if(SILERO_VOICE_NAMES.includes(saved))SILERO_VOICE=saved;}catch{}\nfunction sileroAudioFor(t){const f=SILERO_AUDIO_FILES[voiceKey(t)];return f?'./audio/'+SILERO_VOICE+'/'+f:null;}\nfunction chooseSileroVoice(v){if(!SILERO_VOICE_NAMES.includes(v))return;SILERO_VOICE=v;try{localStorage.setItem('moolva-silero-five-voices',v)}catch{};stopSpeech();const note=document.getElementById('silero-voice-status');if(note)note.textContent='Выбран '+v+'. Все слова, игры и подсказки будут произноситься этим голосом.';}\ndocument.addEventListener('change',e=>{if(e.target?.id==='silero-choice')chooseSileroVoice(e.target.value);});\ndocument.addEventListener('click',e=>{if(e.target?.id==='silero-hello')speak('Привет! Я Финик. Давай вместе говорить.',true,{rate:1});});\nsetTimeout(()=>{const s=document.getElementById('silero-choice');if(s)s.value=SILERO_VOICE;},0);\n"""
voicejs=voicejs.replace('__LOOKUP__',voice_json)
marker='const EMBEDDED_VOICE_PACK={};'
if src.count(marker)<1:raise RuntimeError("No voice marker")
src=src.replace(marker,marker+voicejs,1)
old="const clip=clipFor(text,role)||(role==='helper'?clipFor(text,'finik'):null);"
new="const clip=sileroAudioFor(text)||clipFor(text,role)||(role==='helper'?clipFor(text,'finik'):null);"
if old not in src:raise RuntimeError("Cannot connect MP3 to existing gameplay")
src=src.replace(old,new,1)
src=src.replace('MoOLVa 2.8','MoOLVa 3.0').replace('Голос Финика: выбираем качество','Голоса Silero — выбирайте любой')
src=src.replace('© MoOLVa','© MoOLVa')
(DEST/'index.html').write_text(src,encoding='utf8')
shutil.copytree(OUT/'audio',DEST/'audio',dirs_exist_ok=True)
(DEST/'voice_index.json').write_text(json.dumps({'voices':VOICES,'utterances':len(texts),'files':lookups},ensure_ascii=False),encoding='utf8')
with (DEST/'audio_audit.csv').open('w',encoding='utf-8-sig',newline='') as f:
 w=csv.writer(f,delimiter=';');w.writerow(['Voice','Phrase','MP3','Speech checked manually','Notes'])
 for voice in VOICES:
  for t in texts:w.writerow([voice,t,slug(t),'NO',''])
(DEST/'README_RU.txt').write_text('MoOLVa Говорим: 5 голосов Silero, '+str(len(texts))+' реплик на голос. Откройте index.html из этой папки (не вынимайте его из папки). Для телефона используйте HTTPS-хостинг или распакованную папку в браузере. Все MP3 находятся в audio/. Правильность произношения требует проверки человеком. Сохраняется прежний ключ прогресса.\n',encoding='utf8')
with zipfile.ZipFile(ROOT/'MoOLVa_Govorim_FULL_5_VOICES_WEB.zip','w',compression=zipfile.ZIP_DEFLATED,compresslevel=3) as z:
 for f in DEST.rglob('*'):
  if f.is_file():z.write(f,'MoOLVa_5_voices_WEB/'+str(f.relative_to(DEST)))
print('COMPLETE',status['audio_present'],'MP3','size zip MB',round((ROOT/'MoOLVa_Govorim_FULL_5_VOICES_WEB.zip').stat().st_size/1024**2,2),flush=True)
