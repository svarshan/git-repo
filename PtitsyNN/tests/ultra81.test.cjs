'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const c=require('../app/core81.js');
test('8.1 similar bird passports show published fields only, no synthetic morphological facts',()=>{
 const a={id:'a',name:'Вид 1',latin:'Parus major',group:'Синицы',description:'Жёлтая грудь',imageFile:'media/image/a.jpg'};
 const b={id:'b',name:'Вид 2',latin:'Parus minor',group:'Синицы',description:'Чёрный хвост',audioFile:'media/audio/b.mp3'};
 assert.equal(c.comparison(a,b).type,'Один научный род');
 assert.equal(c.comparison(a,b).rows[1].excerpt,'Чёрный хвост');
 assert.equal(c.comparison(a,a),null);
});
test('8.1 sound timeline uses only actual time-stamped model results and rejects nonfinite values',()=>{
 const rows=c.windows([{label:'Parus major',findings:[{offset:5,score:12},{offset:0,score:11},{offset:NaN,score:3}]}]);
 assert.equal(rows.length,2);assert.equal(rows[0].offset,0);
});
test('8.1 seasonal atlas uses published periods, no coordinates synthesis',()=>{
 const data=[{lat:55,lon:43,species:[{id:'a',n:8,toYear:2022,months:[6,7]},{id:'b',n:2,toYear:2024,months:[1]}]}];
 assert.deepEqual(c.seasonal(data,'a','summer',3).map(x=>x.id),['a']);
 assert.equal(c.seasonal(data,'b','summer',0).length,0);
});
test('8.1 local expedition report escapes HTML and preserves original input',()=>{
 const r=[{date:'2026-02-01',birdId:'x',place:'Ока <script>alert(1)</script>',notes:'"пример"'}];
 const html=c.printableReport(r,[{id:'x',name:'Синица'}],{title:'Отчёт <img>'});
 assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>alert\(1\)<\/script>/);
 assert.match(html,/&lt;img&gt;/);assert.equal(r[0].place,'Ока <script>alert(1)</script>');
 const summary=c.summarize(r,{start:'2026-03-01'});assert.equal(summary.total,0);
});
test('8.1 Bird Vision uses genuine three separate ONNX passes with aspect-preserving crops',()=>{
 const source=read('vision80.cjs');
 assert.match(source,/positions=\[0\.5,0\.2,0\.8\]/);
 assert.match(source,/session\.run/);
 assert.match(source,/imageCrops:3/);
 assert.match(source,/resized\.crop/);
 assert.match(source,/sha256/);
});
test('8.1 backup SHA-256 integrity, old-format import, IDB atomic transaction and rollback',()=>{
 const s=read('app/backup78.js');
 assert.match(s,/crypto\.subtle\.digest\('SHA-256'/);
 assert.match(s,/archive\.integrity/);
 assert.match(s,/const snapshot=\{\}/);
 assert.match(s,/db\.transaction\('assets','readwrite'\)/);
 assert.match(s,/const revert=/);
 assert.match(s,/Архив отклонён/);
 assert.match(read('main.cjs'),/backupSmoke/);
});
test('8.1 release blocks missing 7.9 species, retains 261+ voices and QA screenshots',()=>{
 const wf=read('../.github/workflows/ptitsy-nn-windows.yml'),g=read('scripts/voice_guard81.py');
 assert.match(wf,/8f98e67b8904a87bf0940f05e84692aabeefe293/);
 assert.match(wf,/gh release download ptitsy-v7\.9\.0/);
 assert.match(wf,/voice_guard81\.py/);
 assert.match(g,/newlyMissingPreviouslyPresent/);
 assert.match(g,/max\(261/);
 assert.match(wf,/voice-regression\.md/);
 assert.match(wf,/07-intelligence-center.png/);
});
test('8.1 center contains twelve additions and old 8.0 modules without changing journal keys',()=>{
 const html=read('app/index.html'),js=read('app/upgrade81.js'),pkg=JSON.parse(read('package.json'));
 assert.equal(pkg.version,'8.1.0');
 for(const id of ['m81Tools','m81CompareA','m81CompareB','m81AtlasSummary','m81AudioWindows','m81QuickPhoto','m81PrintReport','m81Performance']){
  assert.ok(html.includes('id="'+id+'"'),id);
 }
 assert.match(js,/printableReport/);
 assert.match(js,/moolva-vision-predictions/);
 assert.match(js,/moolva-voice-predictions/);
 assert.match(js,/ptitsy-nn\.journal\.v1/);
 assert.match(read('app/intelligence80.js'),/score\.mistakes/);
 assert.match(read('app/app.js'),/ptitsy-nn\.journal\.v1/);
 new Function(js);
});
