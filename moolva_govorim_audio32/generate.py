import ast,collections,hashlib,json,pathlib,re,subprocess,tempfile,wave,sys,os
import numpy as np
import torch
ROOT=pathlib.Path(__file__).resolve().parent
BASE=ROOT.parent/'moolva_govorim_voice_sandbox'
OUT=ROOT/'out'
OUT.mkdir(parents=True,exist_ok=True)
base=(BASE/'base_app.html').read_text('utf8')
arr=ast.literal_eval(re.search(r'const ALPHABET=(\[.*?\]);',base,re.S).group(1))
catalog=json.loads((BASE/'catalog_full.json').read_text('utf8'))
def norm(t):return re.sub(r'\s+',' ',t.replace(chr(0x301),'').strip()).lower()
seen={norm(x['text']) for x in catalog['items']}
phrases=[]
def add(text,category):
 k=norm(text)
 if k not in seen:
  seen.add(k);phrases.append({'text':text,'category':category})
for glyph,name,word,emoji,sentence in arr:
 add(f'Это буква {name}.','letter-names')
 add(f'Слово-пример: {word.lower()}.','letter-examples')
nums=['ноль','один','два','три','четыре','пять','шесть','семь','восемь','девять','десять']
for i,num in enumerate(nums):
 add(f'Число {num}.','number-names')
 if i<10:add(f'Это цифра {num}.','number-digits')
for t in ['Сначала послушай, потом повтори.','Это название буквы. А теперь послушай слово.','Названия букв и звуки речи не всегда совпадают.','У твёрдого и мягкого знаков нет отдельного звука.','Послушай название буквы ещё раз.','А теперь послушай слово с этой буквой.','Сначала назовём число, потом посчитаем предметы.','Повтори название числа.','Повтори слово спокойно, не торопись.','Не спеши. Сначала послушай вопрос.','Слушай внимательно, потом отвечай.','У тебя получилось! Попробуем следующее задание.','Если хочешь, нажми на кнопку и послушай ещё раз.','Твоя очередь ответить. Я послушаю.','Посчитаем вместе от одного до десяти.','А сейчас назовём буквы по порядку.']:
 add(t,'instructions')
for t in ['Посмотри, кто на картинке. Поставь это слово первым.','Привет! Я Финик. Давай вместе говорить и играть!']:
 if '${' not in t:add(t,'direct-responses')
(OUT/'extras.json').write_text(json.dumps(phrases,ensure_ascii=False,indent=2),encoding='utf8')
voices=['baya','kseniya','xenia','aidar','eugene']
speaker=sys.argv[1]
if speaker not in voices:raise ValueError('unknown speaker')
torch.set_num_threads(3)
model,_=torch.hub.load('snakers4/silero-models','silero_tts',language='ru',speaker='v5_6_ru',trust_repo=True)
model.to(torch.device('cpu'))
folder=OUT/'audio'/speaker;folder.mkdir(parents=True,exist_ok=True)
errors=[]
for n,rec in enumerate(phrases,1):
 try:
  text=rec['text']
  audio=model.apply_tts(text=text,speaker=speaker,sample_rate=24000)
  pcm=np.asarray(audio.detach().cpu(),dtype=np.float32).reshape(-1)
  if len(pcm)<1000 or not np.isfinite(pcm).all() or np.abs(pcm).max()<.004:raise ValueError('invalid wave')
  name=hashlib.sha256(norm(text).encode('utf-8')).hexdigest()[:32]+'.mp3'
  with tempfile.TemporaryDirectory() as td:
   wavfile=pathlib.Path(td)/'x.wav'
   with wave.open(str(wavfile),'wb') as w:
    w.setnchannels(1);w.setsampwidth(2);w.setframerate(24000)
    w.writeframes((np.clip(pcm,-1,1)*32767).astype('<i2').tobytes())
   dst=folder/name
   subprocess.run(['ffmpeg','-nostdin','-loglevel','error','-y','-i',str(wavfile),'-ac','1','-b:a','64k',str(dst)],check=True,timeout=30)
   if dst.stat().st_size<1200:raise ValueError('audio file too small')
 except Exception as e:errors.append({'index':n,'text':rec['text'],'error':str(e)})
 if n%20==0 or n==len(phrases):print(speaker,n,'/',len(phrases),'bad',len(errors),flush=True)
(OUT/f'report_{speaker}.json').write_text(json.dumps({'voice':speaker,'planned':len(phrases),'errors':errors},ensure_ascii=False,indent=2),encoding='utf8')
if errors:sys.exit(2)
