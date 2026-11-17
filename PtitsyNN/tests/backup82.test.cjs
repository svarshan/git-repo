'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const os=require('node:os'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {saveBackup}=require('../backup82.cjs');
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
test('8.2 restoration distinguishes image/photo MIME from audio, preserving media attachments',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../app/backup78.js'),'utf8');
 assert.match(src,/kind===\x27photo\x27\?\x27image\x27:\x27audio\x27/);
 assert.match(src,/await window\.MoOLVaAutoBackup\.create\(\x27before-restore\x27\)/);
});
test('8.2 creates real SHA256 auto backup and rejects corrupted archives before changes',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'moolva-auto-'));
 try{
  const original={type:'moolva-backup78',version:1,createdAt:'2026-11-01T00:00:00.000Z',
    stores:{'ptitsy-nn.journal.v1':'[]'},assets:[]};
  const archive={...original,integrity:{algorithm:'SHA-256',value:hash(original)}};
  const result=saveBackup(dir,archive,'startup');
  assert.equal(result.saved,true);assert.equal(fs.readdirSync(dir).length,1);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir,result.file),'utf8')),archive);
  assert.throws(()=>saveBackup(dir,{...archive,stores:{'ptitsy-nn.journal.v1':'[1]'}},'before-restore'),/Контрольная/);
  assert.equal(fs.readdirSync(dir).length,1);
  for(let i=0;i<15;i++)saveBackup(dir,archive,'periodic');
  assert.equal(fs.readdirSync(dir).length,12);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
