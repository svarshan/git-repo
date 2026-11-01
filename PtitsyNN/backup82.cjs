'use strict';
/* Automatic, offline, rotation-safe backups of all supported user data. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const MAX=65*1024*1024;
const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function saveBackup(dir,archive,reason='periodic'){
 if(!archive||typeof archive!=='object'||Array.isArray(archive))throw Error('Недопустимый архив');
 if(!['startup','periodic','before-restore','before-update','manual'].includes(reason))throw Error('Недопустимое основание архива');
 const data=JSON.stringify(archive);
 if(Buffer.byteLength(data,'utf8')>MAX)throw Error('Резервная копия превышает 65 МБ');
 if(archive.type!=='moolva-backup78'||archive.version!==1||!archive.stores||typeof archive.stores!=='object'||Array.isArray(archive.stores)||!Array.isArray(archive.assets))throw Error('Неверная структура архива');
 if(!archive.integrity||archive.integrity.algorithm!=='SHA-256'||!/^[0-9a-f]{64}$/.test(archive.integrity.value))throw Error('SHA-256 обязателен');
 const unsigned={type:archive.type,version:archive.version,createdAt:archive.createdAt,stores:archive.stores,assets:archive.assets};
 if(digest(unsigned)!==archive.integrity.value)throw Error('Контрольная сумма архива не совпала');
 for(const [key,value] of Object.entries(archive.stores))if(!key.startsWith('ptitsy-nn.')||typeof value!=='string')throw Error('Недопустимый ключ данных');
 fs.mkdirSync(dir,{recursive:true});
 const name='MoOLVa-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(4).toString('hex')+'.json';
 const dest=path.join(dir,name),temp=dest+'.part';
 try{fs.writeFileSync(temp,data,{flag:'wx',mode:0o600});fs.renameSync(temp,dest);}
 catch(e){try{fs.unlinkSync(temp);}catch{}throw e;}
 // Retain last 12 backups, never remove an external/manual export.
 const all=fs.readdirSync(dir).filter(x=>/^MoOLVa-.*\.json$/.test(x))
  .map(name=>({name,time:fs.statSync(path.join(dir,name)).mtimeMs}))
  .sort((a,b)=>b.time-a.time||b.name.localeCompare(a.name));
 for(const old of all.slice(12))fs.unlinkSync(path.join(dir,old.name));
 return {saved:true,file:name,folder:dir,reason,sha256:crypto.createHash('sha256').update(data).digest('hex')};
}
module.exports={saveBackup};
