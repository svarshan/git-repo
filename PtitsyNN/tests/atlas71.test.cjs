'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('7.1 includes 26 sourced regional city centres, not fake sightings',()=>{
 const box={window:{}};vm.runInNewContext(read('app/settlements.js'),box);
 const a=box.window.MOOLVA_SETTLEMENTS;
 assert.ok(Array.isArray(a)&&a.length>=26,'Expected sourced settlements');
 assert.equal(new Set(a.map(x=>x.name)).size,a.length);
 for(const c of a){assert.ok(c.lat>=54.35&&c.lat<=58.19&&c.lon>=41.60&&c.lon<=47.96,'Town outside map: '+c.name);assert.ok(Number.isInteger(c.tier));}
 assert.ok(a.some(x=>x.name==='Нижний Новгород'));
 assert.ok(a.some(x=>x.name==='Арзамас'));
 assert.ok(a.some(x=>x.name==='Шахунья'));
 assert.match(read('app/settlements.js'),/your-online\.ru\/coordinates/);
});
test('7.1 city layer, pan, zoom, dropdown and nearby evidence links are wired',()=>{
 const html=read('app/index.html'),map=read('app/habitat-atlas.js'),css=read('app/living-world.css');
 for(const id of ['habitatPlace','habitatPlaceSummary','habitatTowns','habitatShowTowns','habitatCenter']){
  assert.match(html,new RegExp('id="'+id+'"'));}
 assert.match(html,/src="settlements\.js"/);
 for(const feature of ['drawTowns','focusTown','distanceKm','pointermove','pointerdown','habitat-town','dataset.zone']) assert.ok(map.includes(feature),feature);
 assert.match(css,/\.habitat-town/);new Function(map);
});
test('7.1 Bird AI visible on home and checks live Electron inference',()=>{
 const html=read('app/index.html'),client=read('app/living6.js'),preload=read('preload.cjs'),main=read('main.cjs');
 assert.match(html,/data-view="birdai"/);
 assert.match(html,/id="birdAIDiagnostics"/);
 assert.match(html,/id="birdAIDiagnosticsStatus"/);
 assert.match(client,/model\.diagnostics\(\)/);
 assert.match(preload,/birdai-diagnostic/);
 assert.match(main,/ipcMain\.handle\('birdai-diagnostic'/);
 assert.match(main,/await model\.run/);
 assert.match(main,/160000/);
 assert.match(main,/micAllowedUntil/);
 new Function(client);new Function(main);
});
test('7.1 Windows EXEs leave 7.0 release untouched',()=>{
 const p=JSON.parse(read('package.json')),wf=read('../.github/workflows/ptitsy-nn-windows.yml');
 assert.equal(p.version,'7.1.0');
 assert.equal(p.build.portable.artifactName,'MoOLVa-7.1-Portable-${arch}.exe');
 assert.equal(p.build.nsis.artifactName,'MoOLVa-7.1-Setup-${arch}.exe');
 assert.match(wf,/Ptitsy-NN-7\.1-Windows/);
 assert.match(wf,/gh release create \$tag/);
 assert.match(wf,/node --check app\/settlements\.js/);
});
