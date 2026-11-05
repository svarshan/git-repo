'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const sandbox={window:{}};vm.runInNewContext(read('catalog.js'),sandbox);
const species=sandbox.window.MOOLVA_MUSHROOMS;
test('53 named taxa, unique labels and no undocumented regional confirmations',()=>{
 assert.equal(species.length,53);
 assert.equal(new Set(species.map(x=>x.latin)).size,53);
 assert.ok(species.every(x=>x.name&&x.traits&&x.habitat&&x.regionVerified===false));
 assert.ok(species.every(x=>Array.isArray(x.months)&&x.months.every(m=>Number.isInteger(m)&&m>=1&&m<=12)));
});
test('known lethal lookalikes are explicitly marked, no automatic food-safety assertion',()=>{
 for(const latin of ['Amanita phalloides','Galerina marginata','Amanita virosa','Cortinarius rubellus']){
   const found=species.find(x=>x.latin===latin);
   assert.ok(found,latin);
   assert.equal(found.risk,'смертельно-ядовитый');
 }
 const html=read('index.html');
 assert.match(html,/Не употребляйте дикорастущие грибы/);
 assert.match(html,/не экспертное определение/);
});
test('offline pages, photo manifests, journal and compare are connected',()=>{
 const html=read('index.html'),js=read('app.js');
 for(const path of ['catalog.js','photos.js','app.js','styles.css'])assert.ok(html.includes(path));
 for(const id of ['catalog','favorites','diary','map','quality','compare','overlay'])assert.ok(html.includes('id="'+id+'"'));
 for(const term of ['localStorage','renderCatalog','renderCompare','renderDiary','renderQuality','stopSpeech','photos[b.latin]'])assert.ok(js.includes(term));
 assert.ok(!/https?:\/\/[^"']+\.js/.test(html),'Remote javascript is forbidden');
});
test('Windows installer, portable, icon and screenshot run are configured',()=>{
 const p=JSON.parse(read('package.json')),main=read('main.cjs');
 assert.equal(p.version,'1.0.0');
 assert.match(p.build.nsis.artifactName,/Setup/);
 assert.match(p.build.portable.artifactName,/Portable/);
 assert.match(main,/capturePage/);
 assert.match(main,/contextIsolation:true/);
 assert.match(main,/nodeIntegration:false/);
});
