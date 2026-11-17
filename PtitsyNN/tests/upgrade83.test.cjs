'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const c=require('../app/core83.js');
test('8.3 search is accent/transliteration aware and matches only published fields',()=>{
 const birds=[{id:'s',name:'Синица большая',latin:'Parus major',group:'Синицевые',description:'Лесная птица',audioFile:'sound.ogg'},
 {id:'d',name:'Дятел',latin:'Dendrocopos major',group:'Дятлы',description:'Дупла деревьев'}];
 assert.equal(c.search(birds,'sinica')[0].id,'s');
 assert.equal(c.search(birds,'Parus major')[0].id,'s');
 assert.equal(c.search(birds,'лесная',{only:'audio'})[0].id,'s');
 assert.equal(c.search(birds,'несуществующий').length,0);
 assert.equal(c.search(birds,'дятел',{only:'audio'}).length,0);
});
test('8.3 review cannot be confused with technical license QA',()=>{
 const b={id:'s',imageFile:'photo.jpg',audioFile:'voice.ogg',imageCredits:{source:'https://commons.wikimedia.org/wiki/File:x',license:'CC BY'},audioCredits:{source:'https://commons.wikimedia.org/wiki/File:y',license:'CC0'}};
 assert.equal(c.mediaStatus(b).audioHuman,false);
 assert.equal(c.mediaStatus(b,{photo:{s:'confirmed'},audio:{s:'questioned'}}).photoHuman,true);
 assert.equal(c.mediaStatus(b,{photo:{s:'confirmed'},audio:{s:'questioned'}}).audioQuestioned,true);
 assert.equal(c.validReview({version:1,photo:{s:'confirmed'},audio:{s:'questioned'}}),true);
 assert.equal(c.validReview({version:1,photo:{s:'auto'},audio:{}}),false);
});
test('8.3 geographic evidence only uses sourced cells and seasonal reports',()=>{
 const birds=[{id:'a',name:'A'},{id:'b',name:'B'}],city={lat:56,lon:44};
 const cells=[{lat:56.1,lon:44.1,species:[{id:'a',n:4,months:[1]},{id:'b',n:7,months:[6]}]},{lat:55,lon:42,species:[{id:'a',n:100,months:[1]}]}];
 assert.deepEqual(c.nearbyEvidence(cells,city,40,'winter',birds).map(x=>x.bird.id),['a']);
 assert.equal(c.nearbyEvidence(cells,city,40,'summer',birds)[0].reports,7);
 assert.equal(c.nearbyEvidence(cells,city,20,'winter',birds).length,1);
});
test('8.3 branded version, backup inclusion, and genuine release controls stay wired',()=>{
 const read=f=>fs.readFileSync(path.resolve(__dirname,'..',f),'utf8');
 const pkg=JSON.parse(read('package.json')),html=read('app/index.html'),backup=read('app/backup82.js'),core78=read('app/ultra78-core.js'),wf=read('../.github/workflows/ptitsy-nn-windows.yml');
 assert.match(pkg.version,/^8\.\d+\.\d+$/);
 assert.ok(pkg.build.win.icon.endsWith('moolva.ico'));
 assert.match(html,/id="media83"/);assert.match(html,/src="core83.js"/);assert.match(html,/src="upgrade83.js"/);
 assert.match(backup,/ptitsy-nn\.media83\.review\.v1/);assert.match(core78,/ptitsy-nn\.media83\.review\.v1/);
 assert.ok(wf.includes('Ptitsy-NN-'+pkg.version.replace(/\.0$/,'')+'-Windows'));assert.match(wf,/release_evidence79\.py finalize/);
 assert.match(html,/id="m83PreUpdate"/);assert.match(backup,/before-update/);
});
