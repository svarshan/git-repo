'use strict';
/* MoOLVa Birds NN 2.7 "Голоса ULTRA"
   Multiple licensed field recordings, private local imports and real-time FFT spectrogram.
   User imports NEVER become curated catalog sounds, never get uploaded. */
(function(){
const DB='moolva-birds-own-recordings-v1',STORE='sounds';
const MIN=2048,MAX=12*1024*1024,LIMIT=4;
const txt=(tag,cls,label)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(label!=null)e.textContent=String(label);return e;};
const attach=(parent,...nodes)=>{for(const n of nodes)parent.appendChild(n);return parent;};
let dbPromise=null,contexts=new WeakMap(),releases=new Set();
function openDB(){
 if(!('indexedDB' in window))return Promise.reject(Error('Локальное хранилище недоступно'));
 if(dbPromise)return dbPromise;
 dbPromise=new Promise((resolve,reject)=>{
  const req=indexedDB.open(DB,1);
  req.onupgradeneeded=()=>{const store=req.result.createObjectStore(STORE,{keyPath:'id'});store.createIndex('latin','latin',{unique:false});};
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||Error('Ошибка доступа к хранилищу'));
 });
 return dbPromise;
}
async function allFor(latin){
 const db=await openDB();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readonly'),request=tx.objectStore(STORE).index('latin').getAll(latin);
  request.onsuccess=()=>resolve(request.result||[]);request.onerror=()=>reject(request.error);
 });
}
async function transact(mode,action){
 const db=await openDB();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,mode),req=action(tx.objectStore(STORE));
  tx.oncomplete=()=>resolve(req?.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Транзакция прервана'));
 });
}
function closeAll(){for(const url of releases){URL.revokeObjectURL(url);}releases.clear();}
function sniff(bytes){
 if(bytes.length<12)return null;
 if(bytes[0]===0x52&&bytes[1]===0x49&&bytes[2]===0x46&&bytes[3]===0x46&&
    String.fromCharCode(...bytes.slice(8,12))==='WAVE')return 'audio/wav';
 if(String.fromCharCode(...bytes.slice(0,4))==='OggS')return 'audio/ogg';
 if(String.fromCharCode(...bytes.slice(0,3))==='ID3'||bytes[0]===0xff&&(bytes[1]&0xe0)===0xe0)return 'audio/mpeg';
 return null;
}
async function addImport(bird,file){
 if(!file||file.size<MIN||file.size>MAX)throw Error('Размер аудио должен быть от 2 КБ до 12 МБ');
 if(!/\.(mp3|wav|ogg)$/i.test(file.name))throw Error('Разрешены WAV, MP3 и OGG');
 const mime=sniff(new Uint8Array(await file.slice(0,16).arrayBuffer()));
 if(!mime)throw Error('Файл не содержит поддерживаемого аудиоформата');
 const old=await allFor(bird.latin);
 if(old.length>=LIMIT)throw Error('Можно сохранить не более 4 своих записей на вид');
 const record={id:bird.latin+'|'+Date.now()+'|'+Math.random().toString(36).slice(2),
               latin:bird.latin,name:file.name.slice(0,140),mime,blob:new Blob([file],{type:mime}),added:new Date().toISOString()};
 await transact('readwrite',store=>store.put(record));
 return record;
}
async function removeImport(id){await transact('readwrite',store=>store.delete(id));}
function makeSpectrogram(audio){
 const box=txt('div','ultra-spectrum');
 const canvas=txt('canvas','ultra-canvas');
 canvas.width=560;canvas.height=125;
 canvas.setAttribute('aria-label','Спектрограмма звучащей записи');
 const note=txt('p','ultra-small','Спектрограмма строится в реальном времени при воспроизведении. Слева — прошлый звук, справа — текущий.');
 attach(box,canvas,note);
 const g=canvas.getContext('2d');
 if(!g)return {box,activate:()=>{}};
 g.fillStyle='#0a2233';g.fillRect(0,0,canvas.width,canvas.height);
 let ctx=null,analyser=null,frame=null,last=0;
 const activate=()=>{
  if(analyser){ctx.resume().catch(()=>{});return;}
  try{
   const Ctx=window.AudioContext||window.webkitAudioContext;
   if(!Ctx){note.textContent='Web Audio API недоступен';return;}
   ctx=new Ctx();
   const source=ctx.createMediaElementSource(audio);
   analyser=ctx.createAnalyser();analyser.fftSize=2048;analyser.smoothingTimeConstant=.46;
   source.connect(analyser);analyser.connect(ctx.destination);
   const frequencies=new Uint8Array(analyser.frequencyBinCount);
   function paint(t){
    if(!analyser)return;
    frame=requestAnimationFrame(paint);
    if(audio.paused||audio.ended||t-last<45)return;
    last=t;
    analyser.getByteFrequencyData(frequencies);
    g.drawImage(canvas,0,0,canvas.width-2,canvas.height,0,0,canvas.width-2,canvas.height);
    g.fillStyle='#0a2233';g.fillRect(canvas.width-2,0,2,canvas.height);
    const sr=ctx.sampleRate;
    for(let y=0;y<canvas.height;y++){
     // Display up to 9 kHz, bottom = low frequencies.
     const hz=(1-y/canvas.height)*Math.min(9000,sr/2);
     const i=Math.min(frequencies.length-1,Math.round(hz/(sr/2)*frequencies.length));
     const a=frequencies[i]/255;
     g.fillStyle='hsl('+(200-175*a)+',95%,'+(8+67*a)+'%)';
     g.fillRect(canvas.width-2,y,2,1);
    }
   }
   frame=requestAnimationFrame(paint);
   ctx.resume().catch(()=>{});
   audio.addEventListener('emptied',()=>{g.fillStyle='#0a2233';g.fillRect(0,0,canvas.width,canvas.height);});
  }catch(e){note.textContent='Спектрограмма недоступна: '+e.message;}
 };
 return {box,activate,dispose:()=>{if(frame)cancelAnimationFrame(frame);if(ctx)ctx.close().catch(()=>{});}};
}
function render(host,bird,audio){
 if(!host)return;
 const root=txt('section','ultra-tracks');
 const heading=txt('div','ultra-title','Голоса ULTRA · звуковые дорожки');
 const choose=txt('select','ultra-choose');choose.setAttribute('aria-label','Выбор звуковой дорожки');
 const hint=txt('p','ultra-small','Основная запись и дополнительные записи из свободных фонотек отмечены отдельно. Свои файлы не проверены и не включаются в распространяемый EXE.');
 const player=audio||txt('audio');
 const ownPlayer=!audio;
 if(ownPlayer){player.controls=true;player.preload='metadata';}
 const view=makeSpectrogram(player);
 const importLabel=txt('label','ultra-import-label','Добавить свою запись WAV / MP3 / OGG');
 const input=txt('input','');input.type='file';input.accept='.wav,.mp3,.ogg,audio/wav,audio/mpeg,audio/ogg';input.setAttribute('aria-label','Импорт своей записи');
 const deleteBtn=txt('button','ultra-delete','Удалить выбранную свою запись');deleteBtn.type='button';deleteBtn.hidden=true;
 const status=txt('p','ultra-small','');
 attach(importLabel,input);
 attach(root,heading,choose,view.box,hint,importLabel,deleteBtn,status);
 if(ownPlayer)root.insertBefore(player,view.box);
 host.appendChild(root);
 let owned=[],liveUrl=null,selected='packaged:0';
 function tracks(){
  const built=[];
  if(bird.audioFile)built.push({id:'packaged:0',name:'Основная · '+(bird.audioCredits?.vocalization||'голос птицы'),
    path:bird.audioFile,credit:bird.audioCredits||{},own:false});
  for(const [i,t] of (Array.isArray(bird.audioTracks)?bird.audioTracks:[]).entries()){
   if(t&&typeof t.path==='string'&&t.path.startsWith('media/audio/'))
    built.push({id:'packaged:'+(i+1),name:'Дополнительная '+(i+1)+' · '+(t.credit?.vocalization||'голос птицы'),path:t.path,credit:t.credit||{},own:false});
  }
  for(const t of owned)built.push({id:'own:'+t.id,name:'Мой файл · '+t.name,blob:t.blob,own:true,credit:{}});
  return built;
 }
 function loadTrack(id,all){
  const t=all.find(v=>v.id===id)||all[0];
  if(!t){player.pause();player.removeAttribute('src');player.load();status.textContent='Записей пока нет. Можно импортировать свой файл.';deleteBtn.hidden=true;return;}
  player.pause();
  if(liveUrl){URL.revokeObjectURL(liveUrl);releases.delete(liveUrl);liveUrl=null;}
  if(t.blob){liveUrl=URL.createObjectURL(t.blob);releases.add(liveUrl);player.src=liveUrl;}
  else player.src=t.path;
  player.load();
  selected=t.id;
  deleteBtn.hidden=!t.own;
  status.textContent=t.own?'Личная запись: вид и качество не проверены. Файл доступен только в этом приложении.':
   ('Источник: '+(t.credit.source||'не указан')+' · '+(t.credit.license||'лицензия не указана')+' · проверка вида по метаданным, не на слух.');
 }
 function fill(){
  const all=tracks();
  choose.replaceChildren();
  for(const t of all){const option=txt('option','',t.name);option.value=t.id;choose.appendChild(option);}
  choose.disabled=all.length===0;
  const chosen=all.some(t=>t.id===selected)?selected:all[0]?.id;
  if(chosen)choose.value=chosen;
  loadTrack(chosen,all);
 }
 choose.addEventListener('change',()=>loadTrack(choose.value,tracks()));
 input.addEventListener('change',async()=>{
  const file=input.files?.[0];input.value='';
  if(!file)return;
  try{const t=await addImport(bird,file);owned=await allFor(bird.latin);selected='own:'+t.id;fill();status.textContent='Запись сохранена только на этом компьютере.';}
  catch(e){status.textContent='Импорт не выполнен: '+e.message;}
 });
 deleteBtn.addEventListener('click',async()=>{
  if(!selected.startsWith('own:'))return;
  if(!confirm('Удалить эту личную запись?'))return;
  try{await removeImport(selected.slice(4));owned=await allFor(bird.latin);selected='packaged:0';fill();}
  catch(e){status.textContent='Не удалось удалить: '+e.message;}
 });
 // Web AudioContext can only be resumed reliably following a deliberate user gesture.
 const begin=()=>view.activate();
 player.addEventListener('play',begin);
 player.addEventListener('click',begin);
 openDB().then(()=>allFor(bird.latin)).then(files=>{if(!root.isConnected)return;owned=files;fill();})
  .catch(e=>{status.textContent='Локальное хранилище недоступно: '+e.message;fill();});
 fill();
}
window.BirdUltra={render,closeAll,sniff};
})();