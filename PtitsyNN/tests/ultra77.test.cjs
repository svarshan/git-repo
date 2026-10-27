'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=s=>fs.readFileSync(path.join(root,s),'utf8');
const core=require('../app/core77.js');
test('8.1 search matches only real catalog terms and handles Russian aliases',()=>{
 const birds=[{id:'1',name:'Большая синица',latin:'Parus major',group:'Воробьинообразные',description:'Встречается в лесах'},
 {id:'2',name:'Малая поганка',latin:'Tachybaptus ruficollis',group:'Водные',description:'Ныряющая птица'}];
 assert.equal(core.fold('  СИНИЦЁ!  '),'синице');
 assert.equal(core.search(birds,'parus')[0].bird.id,'1');
 assert.equal(core.search(birds,'в лесах')[0].bird.id,'1');
 assert.equal(core.search(birds,'синица поганка').length,0);
 assert.equal(core.search(birds,'').length,0);
});
test('8.1 expedition grouping keeps journal records and does not rewrite places',()=>{
 const items=[{id:'a',birdId:'1',place:'Ока',date:'2026-10-20'},{id:'b',birdId:'2',place:'Волга',date:'2026-10-21'}];
 const grouped=core.groupEntries(items,{a:'Воскресная прогулка',b:'Воскресная прогулка'});
 assert.equal(grouped.length,1);assert.equal(grouped[0].records.length,2);assert.equal(grouped[0].types,2);
 assert.equal(items[0].place,'Ока');
});
test('8.1 desktop UI registers all data/offline panels and persists settings separately',()=>{
 const html=read('app/index.html'),css=read('app/ui77.css'),js=read('app/ui77.js'),diary=read('app/expedition77.js'),ai=read('app/living6.js'),map=read('app/habitat-atlas.js');
 for(const id of ['m77Open','m77Palette','m77Query','m77Results','m77Pins','m77PinSettings','m77Width','m77SeasonPresets','m77HabitatGroup','m77AIFilter','m77AIHistoryList','m77ExpeditionGroups','m77ExportExpedition','m77ImportExpedition'])assert.ok(html.includes('id="'+id+'"'),id);
 for(const f of ['core77.js','ui77.js','expedition77.js'])assert.ok(html.includes('src="'+f+'"'),f);
 assert.ok(html.includes('href="ui77.css"'));
 assert.ok(html.includes("connect-src 'none'"));
 assert.match(js,/ctrlKey/);assert.match(js,/ptitsy-nn.ui77.v1/);assert.match(js,/living-open/);
 assert.match(css,/m77-sidebar-width/);
 assert.match(map,/group77/);assert.match(map,/syncPresets77/);
 assert.match(ai,/createBiquadFilter/);assert.match(ai,/ptitsy-nn.ai77.history.v1/);
 assert.match(diary,/indexedDB/);assert.match(diary,/ptitsy-nn.journal.v1/);assert.match(diary,/ptitsy-nn.expedition77.v1/);
 new Function(js);new Function(diary);new Function(ai);new Function(map);
});
test('8.1 preserves old journal and all versions; Windows artifact names exactly match package',()=>{
 const pkg=JSON.parse(read('package.json')),wf=read('../.github/workflows/ptitsy-nn-windows.yml');
 assert.equal(pkg.version,'8.1.0');
 assert.equal(pkg.build.nsis.artifactName,'MoOLVa-8.1-Setup-${arch}.exe');
 assert.equal(pkg.build.portable.artifactName,'MoOLVa-8.1-Portable-${arch}.exe');
 assert.ok(read('app/app.js').includes('ptitsy-nn.journal.v1'));
 assert.ok(read('app/sidebar76.js').includes('ptitsy-nn.sidebar.v76'));
 assert.ok(wf.includes('Ptitsy-NN-8.1-Windows'));
 assert.ok(wf.includes('voices_298.py'));
 for(const s of ['core77.js','ui77.js','expedition77.js'])assert.ok(wf.includes('node --check app/'+s));
});