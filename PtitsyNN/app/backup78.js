'use strict';
/* 7.8 backup: one file for existing journals, UI settings and IndexedDB field attachments. Offline and additive. */
(function(){
 const core=window.MoOLVa78Core,exportBtn=document.getElementById('m78BackupExport'),importBtn=document.getElementById('m78BackupImport'),picker=document.getElementById('m78BackupFile'),status=document.getElementById('m78BackupStatus');
 if(!core||!exportBtn||!importBtn||!picker)return;
 const keys=['ptitsy-nn.journal.v1','ptitsy-nn.favorites.v1','ptitsy-nn.recent.v1','ptitsy-nn.ui3.settings.v1','ptitsy-nn.sidebar.v76','ptitsy-nn.ui77.v1','ptitsy-nn.ui78.v1','ptitsy-nn.academy80.v1','ptitsy-nn.fieldmode80.v1','ptitsy-nn.expedition77.v1','ptitsy-nn.ai77.history.v1','ptitsy-nn.voice-lab.v1','ptitsy-nn.academy.sound.v5','ptitsy-nn.academy.v1'];
 const say=t=>{if(status)status.textContent=t;};
 async function fingerprint(value){
  if(!globalThis.crypto?.subtle)throw Error('Нет защищённого SHA-256 в этом браузерном движке');
  const bytes=new TextEncoder().encode(JSON.stringify(value));
  const hash=await globalThis.crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
 }
 function unsigned(archive){
  return {type:archive.type,version:archive.version,createdAt:archive.createdAt,stores:archive.stores,assets:archive.assets};
 }

 function openDb(){
  return new Promise((resolve,reject)=>{
   const req=indexedDB.open('ptitsy-nn-media77',1);
   req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('assets'))req.result.createObjectStore('assets',{keyPath:'id'});};
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||Error('Локальное хранилище недоступно'));
  });
 }
 async function allAssets(){
  const db=await openDb();
  try{return await new Promise((resolve,reject)=>{
   const tx=db.transaction('assets','readonly'),req=tx.objectStore('assets').getAll();
   req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);
   tx.onerror=()=>reject(tx.error);
  });}finally{db.close();}
 }
 function dataUrl(blob){
  return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(blob);});
 }
 function decode(url,kind){
  if(typeof url!=='string'||url.length>8e6)return null;
  const match=url.match(/^data:(image\/(?:jpeg|png|webp)|audio\/(?:mpeg|wav|ogg|webm|mp4));base64,([A-Za-z0-9+/=]+)$/);
  if(!match||!match[1].startsWith(kind+'/'))return null;
  const raw=atob(match[2]);if(raw.length>(kind==='photo'?3:5)*1024*1024)return null;
  const bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  return new Blob([bytes],{type:match[1]});
 }
 async function exportArchive(){
  exportBtn.disabled=true;say('Формирую полный архив — данные остаются локально…');
  try{
   const stores={};for(const key of keys){const value=localStorage.getItem(key);if(value!==null)stores[key]=value;}
   const records=await allAssets(),assets=[];let total=0;
   for(const record of records){
    const entry={id:String(record.id).slice(0,160)};
    for(const kind of ['photo','audio']){
     const blob=record[kind];
     if(!(blob instanceof Blob))continue;
     if(blob.size>(kind==='photo'?3:5)*1048576)throw Error('Превышен лимит вложений');
     total+=blob.size;if(total>44*1048576)throw Error('Архив вложений больше 44 МБ. Используйте экспорт экспедиций по частям.');
     entry[kind]=await dataUrl(blob);entry[kind+'Name']=String(record[kind+'Name']||kind).slice(0,180);
    }
    assets.push(entry);
   }
   const archive={type:'moolva-backup78',version:1,createdAt:new Date().toISOString(),stores,assets};
   if(!core.validStateArchive(archive))throw Error('Содержимое архива не прошло проверку');
   archive.integrity={algorithm:'SHA-256',value:await fingerprint(unsigned(archive))};
   const u=URL.createObjectURL(new Blob([JSON.stringify(archive)],{type:'application/json;charset=utf-8'}));
   const a=document.createElement('a');a.href=u;a.download='MoOLVa-8.1-Verified-Backup-'+new Date().toISOString().slice(0,10)+'.json';
   document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000);
   say('Архив SHA-256 готов: '+Object.keys(stores).length+' наборов данных, '+assets.length+' записей с вложениями. Сохраните файл в надёжном месте.');
  }catch(error){say('Не удалось создать архив: '+(error.message||error));}
  finally{exportBtn.disabled=false;}
 }
 async function restoreArchive(file){
  if(!file||file.size>65*1048576){say('Ограничение архива — 65 МБ.');return;}
  importBtn.disabled=true;say('Проверяю резервную копию перед восстановлением…');
  try{
   const archive=JSON.parse(await file.text());
   if(!core.validStateArchive(archive))throw Error('Формат, версия или размеры данных не прошли проверку');
   if(archive.integrity){
    if(archive.integrity.algorithm!=='SHA-256'||!/^([a-f0-9]{64})$/.test(archive.integrity.value)||await fingerprint(unsigned(archive))!==archive.integrity.value)
     throw Error('Контрольная сумма резервного архива повреждена. Восстановление запрещено.');
   }else say('Это старый архив без SHA-256; выполнена проверка структуры, но целостность по хешу подтвердить нельзя.');
   const entryIDs=new Set();
   for(const entry of archive.assets){
    if(entryIDs.has(entry.id))throw Error('Дублирующийся идентификатор вложения');
    entryIDs.add(entry.id);
   }
   const known=new Set((window.BIRDS_DATA||[]).map(b=>b.id));
   if(archive.stores['ptitsy-nn.journal.v1']){
    const journal=JSON.parse(archive.stores['ptitsy-nn.journal.v1']);
    if(!Array.isArray(journal)||journal.length>20000||journal.some(x=>!x||typeof x.id!=='string'||!known.has(x.birdId)||typeof x.date!=='string'||typeof x.place!=='string'||!Number.isInteger(x.count)||x.count<1||x.count>99999))throw Error('Дневник содержит недопустимые записи');
   }
   const assets=[];
   for(const entry of archive.assets){
    const obj={id:entry.id};
    for(const kind of ['photo','audio']){
     if(entry[kind]==null)continue;
     const blob=decode(entry[kind],kind);if(!blob)throw Error('Файл вложения повреждён: '+entry.id);
     obj[kind]=blob;obj[kind+'Name']=String(entry[kind+'Name']||kind).slice(0,180);
    }
    assets.push(obj);
   }
   if(!confirm('Резервная копия проверена. Восстановить '+Object.keys(archive.stores).length+' групп настроек/данных и '+assets.length+' наборов вложений? Существующие значения этих ключей будут заменены.')){say('Восстановление отменено.');return;}
   // 8.1: snapshot original localStorage, commit values, then use ONE atomic IDB transaction.
   // On IDB abort, restore old localStorage. A process crash between stores cannot be perfectly atomic;
   // the user keeps the original archive as the recovery source.
   const snapshot={};for(const k of Object.keys(archive.stores))snapshot[k]=localStorage.getItem(k);
   const revert=()=>{for(const [k,v] of Object.entries(snapshot)){
    try{if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v);}catch{}
   }};
   try{for(const [k,v] of Object.entries(archive.stores))localStorage.setItem(k,v);}
   catch(e){revert();throw Error('Недостаточно места в localStorage: старые ключи восстановлены.');}
   let db=null;
   try{
    db=await openDb();
    if(assets.length){
     await new Promise((resolve,reject)=>{
      const tx=db.transaction('assets','readwrite'),store=tx.objectStore('assets');
      tx.oncomplete=resolve;
      tx.onabort=()=>reject(tx.error||Error('IndexedDB transaction aborted'));
      tx.onerror=()=>{};
      for(const item of assets){
       const get=store.get(item.id);
       get.onsuccess=()=>store.put({...get.result,...item});
      }
     });
    }
   }catch(e){revert();throw Error('Вложения не восстановлены, прежние настройки возвращены: '+(e.message||e));}
   finally{db?.close();}
   say('Данные восстановлены. Перезапустите приложение, чтобы разделы перечитали настройки. Старые ключи не удалялись.');
  }catch(error){say('Архив отклонён: '+(error.message||error));}
  finally{importBtn.disabled=false;picker.value='';}
 }
 exportBtn.addEventListener('click',exportArchive);
 importBtn.addEventListener('click',()=>picker.click());
 picker.addEventListener('change',()=>{if(picker.files?.[0])restoreArchive(picker.files[0]);});
})();
