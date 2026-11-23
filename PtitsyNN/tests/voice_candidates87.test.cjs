'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('Xeno-canto review audios stay separate from the 265 original primary recordings',()=>{
 const html=read('app/index.html'),ui=read('app/upgrade86.js'),wf=read('../.github/workflows/ptitsy-nn-windows.yml');
 assert.ok(html.includes('candidate-voices87.js'));
 assert.ok(ui.includes('ptitsy-nn.voice-candidates87.review.v1'));
 assert.match(ui,/requires-independent-listening/);
 assert.match(ui,/НЕ проверен экспертом/);
 assert.match(wf,/stage_xeno87\.py/);
 assert.match(wf,/voice_guard85\.py/);
 for(const f of ['app/backup78.js','app/backup82.js','app/ultra78-core.js'])
  assert.match(read(f),/ptitsy-nn\.voice-candidates87\.review\.v1/);
});
test('all staged source audio bytes match SHA256 and legal provenance when generated',()=>{
 const f=path.join(root,'dist','release-evidence','voice-candidates87.json');
 if(!fs.existsSync(f))return;
 const data=JSON.parse(fs.readFileSync(f,'utf8'));
 assert.equal(data.baselinePrimaryVoices,265);
 assert.equal(data.manualVerified,0);
 assert.ok(data.previewFiles>0&&data.previewFiles<=33);
 assert.equal(data.entries.length,data.previewFiles);
 for(const e of data.entries){
  assert.equal(e.state,'requires-independent-listening');
  assert.equal(e.speciesHumanVerified,false);
  assert.match(e.license,/^https:\/\/creativecommons\.org\/(?:licenses|publicdomain)\//);
  assert.match(e.source,/^https:\/\/xeno-canto\.org\/\d+$/);
  assert.match(e.file,/^media\/audio-candidates87\/[a-z-]+-xc\d+\.mp3$/);
  const target=path.resolve(root,'app',e.file);
  assert.ok(target.startsWith(path.resolve(root,'app','media','audio-candidates87')+path.sep));
  assert.ok(fs.statSync(target).size>=3000);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex'),e.sha256);
 }
});
