'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const core=require('../app/core86.js');
const fixture=[
{id:'a',name:'А',latin:'A a',group:'лес',audioFile:'a.ogg',imageFile:'a.jpg',articleComplete:true},
{id:'b',name:'Б',latin:'B b',group:'лес',audioFile:'b.ogg',imageFile:'b.jpg'},
{id:'c',name:'В',latin:'C c',group:'луг',audioFile:'c.ogg',imageFile:'c.jpg'},
{id:'d',name:'Г',latin:'D d',group:'болото',audioFile:'d.ogg',imageFile:'d.jpg'},
{id:'e',name:'Д',latin:'E e',group:'болото',imageFile:'e.jpg'}];
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('8.6 never equates media presence with verified identity',()=>{
 const s=core.summary(fixture,{version:1,audio:{a:'confirmed',e:'confirmed',b:'questioned'},photo:{a:'confirmed'}});
 assert.equal(s.voices,4);assert.equal(s.missing.length,1);assert.equal(s.audioHuman,1);
 assert.equal(s.audioQuestioned,1);assert.equal(s.photoHuman,1);
 assert.equal(core.sourceSummary(fixture[0]).status,'file-present-not-human-verified');
});
test('8.6 queues exclude missing media and preserve human review',()=>{
 const marks={version:1,audio:{a:'confirmed',b:'questioned'},photo:{}};
 assert.deepEqual(core.queue(fixture,marks,'audio','missing').map(b=>b.id),['e']);
 assert.equal(core.queue(fixture,marks,'audio','questioned')[0].id,'b');
 assert.ok(!core.queue(fixture,marks,'audio','pending').some(b=>b.id==='a'));
});
test('8.6 season evidence uses only recorded source months',()=>{
 const cells=[{name:'Зона',species:[{id:'a',n:2,months:[6,7],fromYear:2020,toYear:2021},
 {id:'b',n:5,months:[1],fromYear:2022,toYear:2022}]}];
 assert.equal(core.seasonEvidence(cells,'a','summer').reports,2);
 assert.equal(core.seasonEvidence(cells,'a','winter').zones,0);
 assert.equal(core.seasonEvidence(cells,'a','summer').years.length,2);
});
test('8.6 audio trainer only uses genuine licensed catalog files',()=>{
 const options=core.quizOptions(fixture,'a',2);
 assert.equal(options.length,4);assert.equal(new Set(options.map(x=>x.id)).size,4);
 assert.ok(options.every(x=>x.audioFile));assert.equal(options.filter(x=>x.id==='a').length,1);
 assert.equal(core.quizOptions(fixture,'e').length,0);
});
test('8.6 model scores are never described as verified probabilities',()=>{
 const r=core.modelAssessment([{label:'A a',score:.9},{label:'B b',score:.86}],fixture);
 assert.equal(r.ambiguous,true);assert.equal(r.candidates[0].bird.id,'a');assert.match(r.note,/не являются вероятностями/);
});
test('8.6 integrates all modules, preserves icon, backup and audio baseline guard',()=>{
 const pkg=JSON.parse(read('package.json')),html=read('app/index.html'),workflow=read('../.github/workflows/ptitsy-nn-windows.yml');
 assert.equal(pkg.version,'8.6.0');
 for(const x of ['media86','m86Backup','m86QuizNew','m86VisionAI','m86VoiceAI','m86VerifyBackups','m86Compact','m86Bird'])assert.match(html,new RegExp('id="'+x+'"'));
 for(const x of ['core86.js','upgrade86.js','upgrade86.css'])assert.ok(html.includes(x));
 assert.equal(pkg.build.win.icon,'build/moolva.ico');
 assert.match(workflow,/voice_guard85\.py/);
 assert.match(workflow,/Ptitsy-NN-8\.6-Portable-only/);
});
