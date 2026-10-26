'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const core=require('../app/ultra78-core.js');
test('7.9 Bird AI highlights ambiguous relative model scores but never invents probabilities',()=>{
 assert.equal(core.evidence([]).status,'insufficient');
 assert.equal(core.evidence([{score:44},{score:43}]).status,'ambiguous');
 assert.equal(core.evidence([{score:80},{score:12}]).status,'candidate');
 assert.match(core.evidence([{score:80},{score:12}]).message,/не является вероятностью/);
});
test('7.9 field map reports actual source density without claiming current birds',()=>{
 const result=core.sourceQuality([{n:6,toYear:2021},{n:9,toYear:2024}],true);
 assert.equal(result.sightings,15);assert.equal(result.latest,2024);assert.equal(result.coverage,'умеренно записей');
 assert.match(result.note,/не прогноз/);
});
test('7.9 field diary can filter dates and count original observations',()=>{
 const records=[{birdId:'a',date:'2026-02-10',place:'Ока',count:3},
 {birdId:'b',date:'2026-03-10',place:'Волга',count:1}];
 const filtered=core.filterJournal(records,'2026-02-01','2026-02-28','ока');
 assert.equal(filtered.length,1);assert.equal(filtered[0].count,3);
 assert.deepEqual(core.journalStats(filtered),{observations:1,species:1,locations:1,individuals:3});
});
test('7.9 archive rejects unknown keys and oversized attachments',()=>{
 const basic={type:'moolva-backup78',version:1,stores:{'ptitsy-nn.journal.v1':'[]'},assets:[]};
 assert.equal(core.validStateArchive(basic),true);
 assert.equal(core.validStateArchive({...basic,stores:{evil:'foo'}}),false);
 assert.equal(core.validStateArchive({...basic,assets:[{id:'1',photo:'data:'+('a'.repeat(9000000))}]}),false);
 assert.equal(core.validStateArchive({...basic,version:2}),false);
});
test('7.9 contains all ten additive interfaces, old journal remains',()=>{
 const html=read('app/index.html'),ai=read('app/living6.js'),ui=read('app/ultra78-ui.js'),backup=read('app/backup78.js'),css=read('app/ultra78.css'),compare=read('app/compare6.js');
 for(const id of ['m78Species','m78SpeciesTabs','m78SpeciesPanel','m78MapQuality','m78JournalStats','m78From','m78To','m78VoiceA','m78VoiceB','m78SpectrumA','m78SpectrumB','m78Font','m78Cards','m78PhotoOpen','m78Lightbox','m78BackupExport','m78BackupImport','m78BackupStatus'])
 assert.ok(html.includes('id="'+id+'"'),'Missing '+id);
 for(const script of ['ultra78-core.js','ultra78-ui.js','backup78.js'])assert.ok(html.includes('src="'+script+'"'));
 assert.ok(html.includes('href="ultra78.css"'));
 assert.match(backup,/indexedDB/);assert.match(backup,/ptitsy-nn-media77/);assert.match(backup,/validStateArchive/);assert.match(backup,/confirm\(/);
 assert.match(ai,/MoOLVa78Core/);assert.match(ui,/getByteFrequencyData/);assert.match(ui,/m78SpeciesPanel/);
 assert.match(compare,/six-compare-card/);assert.match(css,/m78-large-cards/);
 assert.match(read('app/app.js'),/ptitsy-nn.journal.v1/);
 assert.ok(html.includes("connect-src 'none'"));
 new Function(ai);new Function(ui);new Function(backup);
});
test('7.9 packaging keeps Windows x64 portable and setup',()=>{
 const pkg=JSON.parse(read('package.json')),wf=read('../.github/workflows/ptitsy-nn-windows.yml');
 assert.equal(pkg.version,'7.9.0');
 assert.equal(pkg.build.nsis.artifactName,'MoOLVa-7.9-Setup-${arch}.exe');
 assert.equal(pkg.build.portable.artifactName,'MoOLVa-7.9-Portable-${arch}.exe');
 assert.ok(wf.includes('Ptitsy-NN-7.9-Windows'));
 for(const script of ['ultra78-core.js','ultra78-ui.js','backup78.js'])assert.ok(wf.includes('node --check app/'+script));
 assert.ok(wf.includes('voices_298.py'));assert.ok(wf.includes('fill_missing76.py'));
});
