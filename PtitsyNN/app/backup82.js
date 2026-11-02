'use strict';
/* Periodic local snapshots and mandatory pre-restore snapshot; no cloud upload. */
(()=>{
 const bridge=window.MoOLVaBackup;
 if(!bridge?.save)return;
 const keys=['ptitsy-nn.journal.v1','ptitsy-nn.favorites.v1','ptitsy-nn.recent.v1','ptitsy-nn.ui3.settings.v1','ptitsy-nn.sidebar.v76','ptitsy-nn.ui77.v1','ptitsy-nn.ui78.v1','ptitsy-nn.academy80.v1','ptitsy-nn.fieldmode80.v1','ptitsy-nn.expedition77.v1','ptitsy-nn.ai77.history.v1','ptitsy-nn.voice-lab.v1','ptitsy-nn.academy.sound.v5','ptitsy-nn.academy.v1','ptitsy-nn.media83.review.v1','ptitsy-nn.installed-version.v1'];
 const sha=async obj=>{
  const bytes=new TextEncoder().encode(JSON.stringify(obj));
  const buf=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(buf)].map(n=>n.toString(16).padStart(2,'0')).join('');
 };
 function assetsDb(){
  return new Promise((ok,fail)=>{
   const req=indexedDB.open('ptitsy-nn-media77',1);
   req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('assets'))req.result.createObjectStore('assets',{keyPath:'id'});};
   req.onsuccess=()=>ok(req.result);req.onerror=()=>fail(req.error||Error('Нет доступа к вложениям'));
  });
 }
 async function attachments(){
  const db=await assetsDb();
  try{
   const records=await new Promise((ok,fail)=>{
    const tx=db.transaction('assets','readonly'),r=tx.objectStore('assets').getAll();
    r.onsuccess=()=>ok(r.result||[]);r.onerror=()=>fail(r.error);
   });
   const result=[];let total=0;
   for(const record of records){
    const entry={id:String(record.id).slice(0,160)};
    for(const kind of ['photo','audio']){
     const blob=record[kind];if(!(blob instanceof Blob))continue;
     if(blob.size>(kind==='photo'?3:5)*1048576)throw Error('Вложение превышает лимит');
     total+=blob.size;if(total>44*1048576)throw Error('Вложения превышают 44 МБ');
     const value=await new Promise((ok,fail)=>{const reader=new FileReader();reader.onload=()=>ok(reader.result);reader.onerror=()=>fail(reader.error);reader.readAsDataURL(blob);});
     entry[kind]=value;entry[kind+'Name']=String(record[kind+'Name']||kind).slice(0,180);
    }
    result.push(entry);
   }
   return result;
  }finally{db.close();}
 }
 let working=null,lastSignature=null;
 async function snapshot(reason='periodic'){
  if(working)return working;
  working=(async()=>{
   const stores={};for(const key of keys){const val=localStorage.getItem(key);if(val!==null)stores[key]=val;}
   const media=await attachments();
   const state={stores,assets:media};
   const signature=await sha(state);
   if(reason==='periodic'&&signature===lastSignature)return {saved:false,unchanged:true};
   const archive={type:'moolva-backup78',version:1,createdAt:new Date().toISOString(),...state};
   if(!window.MoOLVa78Core?.validStateArchive(archive))throw Error('Резервный архив не прошёл проверку структуры');
   archive.integrity={algorithm:'SHA-256',value:await sha(archive)};
   const result=await bridge.save(archive,reason);
   if(!result?.saved)throw Error('Резервное копирование не подтверждено');
   lastSignature=signature;
   return result;
  })();
  try{return await working;}finally{working=null;}
 }
 window.MoOLVaAutoBackup={create:snapshot};
 const status=document.getElementById('m78BackupStatus');
 const report=error=>{if(status)status.textContent='Автоматическое резервирование: '+(error.message||error);};
 setTimeout(async()=>{
  try{
   const previous=localStorage.getItem('ptitsy-nn.installed-version.v1');
   const hadUserData=keys.some(k=>k!=='ptitsy-nn.installed-version.v1'&&localStorage.getItem(k)!==null);
   const reason=(previous!=='8.4.0'&&(previous!==null||hadUserData))?'before-update':'startup';
   await snapshot(reason);
   localStorage.setItem('ptitsy-nn.installed-version.v1','8.4.0');
  }catch(error){report(error);}
 },3000);
 setInterval(()=>snapshot('periodic').catch(report),5*60*1000);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')snapshot('periodic').catch(report);});
})();