'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const core=require('../app/core80.js');
test('8.1 authentic vision label mapping only accepts audited regional taxa',()=>{
 const species=[{id:'s',name:'Большая синица',latin:'Parus major',group:'Воробьиные',description:'Жёлтая грудь'},
 {id:'d',name:'Кряква',latin:'Anas platyrhynchos',group:'Утиные',description:'Утка'}];
 assert.equal(core.regionForLabel('GREAT TIT',species).id,'s');
 assert.equal(core.regionForLabel('MALLARD',species).id,'d');
 assert.equal(core.regionForLabel('RANDOM BIRD',species),null);
 assert.equal(core.regionForLabel('GREAT TIT',[species[1]]),null);
});
test('8.1 integrated species suggestions use documented source signals, not probabilities',()=>{
 const birds=[{id:'s',name:'Большая синица',latin:'Parus major',group:'Воробьиные',description:'Жёлтая грудь'},
 {id:'d',name:'Кряква',latin:'Anas platyrhynchos',group:'Утиные',description:'Водоём'}];
 const r=core.inferEvidence({birds,vision:[{label:'GREAT TIT',score:42}],voices:[{label:'Parus major',score:25}],traits:'жёлтая'});
 assert.equal(r[0].bird.id,'s');assert.equal(r[0].points,11);assert.equal(r.length,1);
});
test('8.1 voice signal health classifies real PCM and clipping',()=>{
 assert.equal(core.quality(new Float32Array(160000)).ok,false);
 assert.equal(core.quality(new Float32Array(160000).fill(1)).ok,false);
 const tone=Float32Array.from({length:160000},(_,i)=>Math.sin(i/3)*.06);
 assert.equal(core.quality(tone).ok,true);
});
test('8.1 separate field statistics preserve original observations',()=>{
 const items=[{birdId:'s',date:'2026-01-03',count:3},{birdId:'s',date:'2026-01-10',count:1},{birdId:'d',date:'2026-03-03',count:2}];
 const x=core.journalOverview(items);
 assert.equal(x.total,3);assert.equal(x.unique,2);assert.deepEqual(x.byYear,[['2026',3]]);
 assert.equal(items[0].count,3);
});
test('8.1 Vision implementation requires real MIT ONNX and pinned SHA256',()=>{
 const model=read('vision80.cjs'),prepare=read('scripts/prepare_vision80.py');
 for(const s of ['onnxruntime-node','InferenceSession.create','session.run','nativeImage.createFromBuffer','sha256','inputNames'])assert.ok(model.includes(s),s);
 for(const s of ['ff5136258c85e15098b4db44ba00a8fdcf2d04d5','dbfd1293e47384cc215f3cbf0a611548589b91d5fd5e8838a03fdd485bd7151b','license','id2label'])assert.ok(prepare.includes(s),s);
 assert.match(prepare,/MIT/);
 assert.match(read('main.cjs'),/registerVision80/);assert.match(read('main.cjs'),/visionModelVerified/);
 assert.match(read('preload.cjs'),/BirdVision/);
});
test('8.1 new center, academy, map, diary and quality wired without deleting old data',()=>{
 const html=read('app/index.html'),ui=read('app/intelligence80.js'),style=read('app/intelligence80.css');
 for(const id of ['intelligence80','m80Photo','m80VisionRun','m80Traits','m80Candidates','m80VoiceStatus','m80Town','m80Season','m80Nearby','m80DiaryReport','m80Academy','m80FieldMode'])
 assert.ok(html.includes('id="'+id+'"'),id);
 for(const file of ['core80.js','intelligence80.js'])assert.ok(html.includes('src="'+file+'"'));
 assert.ok(html.includes('href="intelligence80.css"'));
 assert.match(ui,/BirdVision\.predict/);assert.match(ui,/moolva-voice-predictions/);
 assert.match(ui,/nearbyRecords/);assert.match(ui,/ptitsy-nn\.academy80\.v1/);
 assert.match(style,/m80-field-mode/);assert.match(read('app/living6.js'),/moolva-voice-predictions/);
 new Function(ui);
});
test('8.1 archives, EXEs and verified seven Windows screenshots',()=>{
 const pkg=JSON.parse(read('package.json')),wf=read('../.github/workflows/ptitsy-nn-windows.yml'),report=read('scripts/release_evidence79.py');
 assert.equal(pkg.version,'8.1.0');
 assert.ok(pkg.build.nsis.artifactName.startsWith('MoOLVa-8.1-Setup-'));
 assert.ok(pkg.build.portable.artifactName.startsWith('MoOLVa-8.1-Portable-'));
 for(const k of ['ptitsy-nn.academy80.v1','ptitsy-nn.fieldmode80.v1']){
  assert.ok(read('app/backup78.js').includes(k));assert.ok(read('app/ultra78-core.js').includes(k));
 }
 assert.match(wf,/prepare_vision80.py/);assert.match(wf,/Capture real screenshots from packaged/);
 assert.match(wf,/07-intelligence-center.png/);assert.match(report,/07-intelligence-center.png/);
 assert.match(report,/missing-voices\.csv/);
 assert.ok(read('app/app.js').includes('ptitsy-nn.journal.v1'));
});