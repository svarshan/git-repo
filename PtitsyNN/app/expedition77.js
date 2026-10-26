'use strict';
/* MoOLVa 7.7 field records: non-destructive expedition labels + offline IndexedDB attachments. */
(function(){
 const core=window.MoOLVa77Core,root=document.getElementById('m77ExpeditionGroups');
 if(!root||!core)return;
 const status=document.getElementById('m77ExpeditionStatus'),key='ptitsy-nn.expedition77.v1';
 const names=new Map((window.BIRDS_DATA||[]).map(b=>[b.id,b.name]));
 const make=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=String(text);if(cls)e.className=cls;return e;};
 const tell=s=>{if(status)status.textContent=s;};
 const safeRead=()=>{
  try{const a=JSON.parse(localStorage.getItem('ptitsy-nn.journal.v1')||'[]');return Array.isArray(a)?a.filter(x=>x&&typeof x.id==='string'&&names.has(x.birdId)):[];}catch{return[];}
 };
 let labels={};try{const a=JSON.parse(localStorage.getItem(key)||'{}');if(a&&typeof a==='object'&&!Array.isArray(a))labels=a;}catch{}
 const save=()=>{try{localStorage.setItem(key,JSON.stringify(labels));return true;}catch{tell('Нет свободного места для меток экспедиций');return false;}};
 function database(){
  return new Promise((resolve,reject)=>{
   if(!window.indexedDB)return reject(Error('Хранилище файлов недоступно'));
   const r=indexedDB.open('ptitsy-nn-media77',1);
   r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('assets'))r.result.createObjectStore('assets',{keyPath:'id'});};
   r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||Error('IndexedDB'));
  });
 }
 async function getAsset(id){
  const db=await database();return new Promise((resolve,reject)=>{
   const tx=db.transaction('assets','readonly'),req=tx.objectStore('assets').get(id);
   req.onsuccess=()=>resolve(req.result||{id});req.onerror=()=>reject(req.error);tx.oncomplete=()=>db.close();tx.onerror=()=>reject(tx.error);
  });
 }
 async function putAsset(data){
  const db=await database();return new Promise((resolve,reject)=>{
   const tx=db.transaction('assets','readwrite');tx.objectStore('assets').put(data);
   tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};
  });
 }
 async function getAllAssets(){
  const db=await database();return new Promise((resolve,reject)=>{
   const tx=db.transaction('assets','readonly'),req=tx.objectStore('assets').getAll();
   req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);
   tx.oncomplete=()=>db.close();tx.onerror=()=>reject(tx.error);
  });
 }
 const urls=new Set();
 function reset(){for(const u of urls)URL.revokeObjectURL(u);urls.clear();root.replaceChildren();}
 async function attach(id,kind,file){
  const accepted=kind==='photo'?['image/jpeg','image/png','image/webp']:['audio/mpeg','audio/wav','audio/ogg','audio/webm','audio/mp4'];
  const max=kind==='photo'?3*1024*1024:5*1024*1024;
  if(!accepted.includes(file.type)||file.size<50||file.size>max){tell('Недопустимый формат или размер. Фото до 3 МБ, аудио до 5 МБ.');return;}
  if(!safeRead().some(x=>x.id===id)){tell('Запись удалена из дневника.');return;}
  try{const item=await getAsset(id);item[kind]=file;item[kind+'Name']=file.name.slice(0,180);await putAsset(item);tell('Файл сохранён локально в IndexedDB. Для переноса выгрузите архив 7.7.');render();}
  catch(err){tell('Не удалось записать файл: '+err.message);}
 }
 function download(name,json){
  const url=URL.createObjectURL(new Blob([JSON.stringify(json)],{type:'application/json'})),a=make('a');
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3500);
 }
 const asData=blob=>new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(fr.result);fr.onerror=()=>reject(fr.error);fr.readAsDataURL(blob);});
 function fromData(data,type){
  if(typeof data!=='string'||data.length>8e6)return null;
  const m=data.match(/^data:(image\/(?:jpeg|png|webp)|audio\/(?:mpeg|wav|ogg|webm|mp4));base64,([a-zA-Z0-9+/=]+)$/);
  if(!m||!m[1].startsWith(type+'/'))return null;
  const raw=atob(m[2]);if(raw.length>5*1024*1024)return null;
  const bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  return new Blob([bytes],{type:m[1]});
 }
 async function exportBundle(){
  const existing=safeRead(),ids=new Set(existing.map(x=>x.id)),assets=[];
  tell('Подготавливаю локальные вложения для архива…');
  try{
   const records=(await getAllAssets()).filter(x=>ids.has(x.id));
   let total=0;
   for(const x of records){
    const entry={id:x.id};
    for(const kind of ['photo','audio'])if(x[kind] instanceof Blob){
     total+=x[kind].size;if(total>45*1024*1024)throw Error('Вложения больше 45 МБ: разделите дневник на несколько архивов.');
     entry[kind]=await asData(x[kind]);entry[kind+'Name']=x[kind+'Name']||'';
    }
    assets.push(entry);
   }
   download('MoOLVa-expeditions-7.7.json',{type:'ptitsy-nn-expedition77',version:1,labels,assets,exportedAt:new Date().toISOString()});
   tell('Экспортированы метки и '+assets.length+' наборов вложений. Старый журнал остаётся без изменений.');
  }catch(e){tell('Ошибка экспорта: '+e.message);}
 }
 async function importBundle(file){
  if(!file||file.size>65*1024*1024){tell('Размер архива превышает 65 МБ.');return;}
  try{
   const data=JSON.parse(await file.text());
   if(data?.type!=='ptitsy-nn-expedition77'||data.version!==1||!data.labels||typeof data.labels!=='object'||Array.isArray(data.labels)||!Array.isArray(data.assets)||data.assets.length>2000)throw Error('Неверный формат архива.');
   const ids=new Set(safeRead().map(x=>x.id));
   let updated=0,restored=0;
   for(const [id,value] of Object.entries(data.labels)){
    if(ids.has(id)&&typeof value==='string'&&value.length<=100){labels[id]=value;updated++;}
   }
   save();
   for(const rec of data.assets){
    if(!rec||!ids.has(rec.id))continue;
    const existing=await getAsset(rec.id);
    for(const kind of ['photo','audio']){
     const blob=fromData(rec[kind],kind);
     if(blob&&blob.size<=(kind==='photo'?3:5)*1024*1024){existing[kind]=blob;existing[kind+'Name']=String(rec[kind+'Name']||kind).slice(0,180);}
    }
    await putAsset(existing);restored++;
   }
   tell('Импортировано меток: '+updated+'; вложений: '+restored+'. Исходный дневник не заменён.');render();
  }catch(e){tell('Импорт отменён: '+e.message);}
 }
 async function mediaControls(row,j){
  try{
   const stored=await getAsset(j.id);
   if(!row.isConnected)return;
   for(const kind of ['photo','audio']){
    const label=make('label',kind==='photo'?'Прикрепить фото':'Прикрепить аудио');
    const f=make('input');f.type='file';f.accept=kind==='photo'?'image/jpeg,image/png,image/webp':'audio/mpeg,audio/wav,audio/ogg,audio/webm,audio/mp4';
    f.addEventListener('change',()=>{if(f.files?.[0])attach(j.id,kind,f.files[0]);});
    label.append(f);row.append(label);
    if(stored[kind] instanceof Blob){
     const url=URL.createObjectURL(stored[kind]);urls.add(url);
     if(kind==='photo'){const img=make('img');img.src=url;img.alt='Личное фото к наблюдению';img.loading='lazy';img.width=105;img.height=75;img.style.objectFit='cover';row.append(img);}
     else{const audio=make('audio');audio.src=url;audio.controls=true;audio.preload='none';audio.style.maxWidth='210px';row.append(audio);}
     const link=make('a','Сохранить '+kind);link.href=url;link.download=stored[kind+'Name']||kind;row.append(link);
    }
   }
  }catch{row.append(make('small','Вложения недоступны на этом компьютере'));}
 }
 function render(){
  reset();const items=safeRead(),groups=core.groupEntries(items,labels);
  if(!items.length){root.append(make('p','Записей пока нет. Добавьте наблюдение выше.','living-note'));return;}
  for(const g of groups){
   const section=make('details'),summary=make('summary',g.name+' · встреч: '+g.records.length+' · видов: '+g.types);
   section.append(summary);
   for(const j of g.records.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)))){
    const row=make('div',null,'m77-meta-row'),name=make('span',(names.get(j.birdId)||'Вид')+' · '+String(j.date).slice(0,16));
    const label=make('input');label.type='text';label.maxLength=100;label.placeholder='Название экспедиции (необязательно)';label.value=String(labels[j.id]||'');
    label.setAttribute('aria-label','Экспедиция для '+names.get(j.birdId));
    label.addEventListener('change',()=>{const v=label.value.trim().slice(0,100);if(v)labels[j.id]=v;else delete labels[j.id];if(save())render();});
    row.append(name,label);
    const media=make('div',null,'m77-meta-row');section.append(row,media);mediaControls(media,j);
   }
   root.append(section);
  }
 }
 document.getElementById('m77ExportExpedition')?.addEventListener('click',exportBundle);
 const pick=document.getElementById('m77ExpeditionFile');
 document.getElementById('m77ImportExpedition')?.addEventListener('click',()=>pick?.click());
 pick?.addEventListener('change',()=>{if(pick.files?.[0])importBundle(pick.files[0]);pick.value='';});
 document.addEventListener('click',e=>{if(e.target.closest?.('button[data-view="journal"],#importJSON,#newObservation'))queueMicrotask(render);});
 const items=document.getElementById('journalItems');
 if(items)new MutationObserver(()=>queueMicrotask(render)).observe(items,{childList:true});
 window.addEventListener('moolva75-journal-changed',render);
 render();
})();
