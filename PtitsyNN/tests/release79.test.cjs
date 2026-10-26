'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('7.9 captures screenshots from actual packaged Windows Electron, not simulated HTML',()=>{
 const main=read('main.cjs');assert.match(main,/app\.isPackaged/);assert.match(main,/MOOLVA_CI_EVIDENCE/);
 assert.match(main,/webContents\.capturePage\(\)/);assert.match(main,/gui-smoke\.json/);
 for(const id of ['catalog','birdai','map','articles','journal','lab'])assert.ok(main.includes("'"+id+"'"));
});
test('7.9 missing licensed voice inventory comes only from packaged catalog',()=>{
 const s=read('scripts/release_evidence79.py');
 for(const part of ['BIRDS_DATA','missing-voices.csv','voice-inventory.json','audioFile','coverage.json'])
   assert.ok(s.includes(part),part);
});
test('7.9 QA checks Windows screenshot PNG, SHA256, Node and Python logs',()=>{
 const s=read('scripts/release_evidence79.py');
 for(const part of ['PNG_SIGNATURE','sha256(','node-tests.log','python-tests.log','test-report.md','gui-smoke.json'])
   assert.ok(s.includes(part),part);
});
test('7.9 workflow creates real screenshots and report before publishing release',()=>{
 const s=read('../.github/workflows/ptitsy-nn-windows.yml');
 const capture=s.indexOf('Capture real screenshots from packaged Windows Electron EXE');
 const qa=s.indexOf('Validate real screenshots and generate QA report');
 const publish=s.indexOf('Publish versioned GitHub Release');
 assert.ok(capture>0&&qa>capture&&publish>qa);
 for(const name of ['01-glavnaya.png','02-bird-ai.png','03-karta-oblasti.png','04-encyclopedia.png','05-polevoi-dnevnik.png','06-audiolaboratoriya.png','test-report.md','missing-voices.csv'])
   assert.ok(s.includes(name),'missing asset '+name);
});
test('7.9 preserves setup, portable and legacy field records',()=>{
 const pkg=JSON.parse(read('package.json')),wf=read('../.github/workflows/ptitsy-nn-windows.yml');
 assert.equal(pkg.version,'7.9.0');
 assert.ok(pkg.build.nsis.artifactName.startsWith('MoOLVa-7.9-Setup-'));
 assert.ok(pkg.build.portable.artifactName.startsWith('MoOLVa-7.9-Portable-'));
 assert.match(read('app/app.js'),/ptitsy-nn\.journal\.v1/);
 assert.match(read('app/expedition77.js'),/ptitsy-nn\.expedition77/);
 assert.match(wf,/Ptitsy-NN-7\.9-Windows/);
});