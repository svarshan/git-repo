'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const c=require('../app/core84.js'),read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
test('8.4 search uses documented description, no invented traits',()=>{
 const birds=[{id:'a',name:'Белая птица',latin:'A a',description:'Лес, длинный клюв',audioFile:'a.mp3'},
 {id:'b',name:'Серая птица',latin:'B b',description:'Река и короткий клюв'}];
 assert.equal(c.findByTraits(birds,'лес клюв')[0].bird.id,'a');
 assert.equal(c.findByTraits(birds,'лес клюв',true).length,1);
 assert.equal(c.findByTraits(birds,'неизвестный').length,0);
});
test('8.4 year filtering refuses unstated source years',()=>{
 const cells=[{species:[{id:'a',n:4,fromYear:2015,toYear:2019},{id:'b',n:8}]}];
 assert.equal(c.historicalEvidence(cells,null,2017).length,1);
 assert.equal(c.historicalEvidence(cells,'a',2024).length,0);
});
test('8.4 AI keeps relative scores and reveals ambiguity',()=>{
 const r=c.modelEvidence([{label:'A',score:1.0},{label:'B',score:.98}]);
 assert.equal(r.ambiguous,true);assert.equal(r.top[0].label,'A');
 assert.equal(c.modelEvidence([{label:'A',score:2.0},{label:'B',score:.2}]).ambiguous,false);
});
test('8.4 installed modules and Windows artifact versions',()=>{
 const pkg=JSON.parse(read('package.json')),html=read('app/index.html'),wf=read('../.github/workflows/ptitsy-nn-windows.yml');
 assert.equal(pkg.version,'8.6.0');assert.match(html,/id="m84Tools"/);
 assert.match(html,/src="core84.js"/);assert.match(html,/src="upgrade84.js"/);
 assert.match(wf,/Ptitsy-NN-8\.6-Windows/);assert.match(wf,/voice_guard84\.py/);
 assert.match(read('app/backup82.js'),/before-update/);
});
