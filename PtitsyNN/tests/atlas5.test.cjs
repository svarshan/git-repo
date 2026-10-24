'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('MoOLVa 6.0 wires seasonal map and authentic voice academy without live network calls',()=>{
 const html=read('app/index.html'),js=read('app/habitat-atlas.js'),academy=read('app/atlas5-extras.js');
 for(const id of ['habitatMonth','habitatStats','habitatSelection','habitatExport','academyAudioQuiz','academyAudioScore','atlas5Backup','atlas5Restore','atlas5BackupFile','atlas5BackupStatus']){
  assert.ok(html.includes('id="'+id+'"'),'Missing offline UI control: '+id);
 }
 for(const file of ['atlas5.css','atlas5-extras.js'])assert.match(html,new RegExp(file.replace('.','\\.')));
 for(const part of ['selectedMonth','data.generated','BirdHabitat','source','exportCSV','thumbnail','focusSpecies']){
  assert.ok(js.includes(part),'Missing map feature '+part);
 }
 for(const part of ['audioFile','preload','Bird','localStorage','academyAudioQuiz','stopAudio','location.reload']){
  assert.ok(academy.includes(part),'Missing sound/backup feature '+part);
 }
 assert.match(html,/connect-src 'none'/);
 assert.doesNotMatch(html,/<script[^>]+src="https?:/);
 new Function(js);new Function(academy);
});
test('seasonal API pipeline separates CC-licensed observations and coarse geographic cells',()=>{
 const py=read('scripts/make_habitat.py');
 for(const part of ['license_allowed','CC_BY_4_0','CC0_1_0','valid_region','informationWithheld','dataGeneralizations',
   'GRID_LAT','GRID_LON','monthly_dates','monthEvidenceMinRecords','len(dates','len(monthly_dates','n<3']){
  assert.ok(py.includes(part),'Missing atlas safety/quality feature '+part);
 }
 const code=read('app/habitat-data.js');const scope={window:{}};
 vm.runInNewContext(code,scope);
 const data=scope.window.HABITAT_DATA;
 assert.ok(data && data.bounds && data.cells.length>0);
 assert.ok(data.sampledRecords>0 && data.matchingRecords>0);
 for(const c of data.cells){
  for(const bird of c.species){
   assert.ok(bird.n>=3 && bird.fromYear<=bird.toYear);
   assert.ok(Array.isArray(bird.months));
   assert.ok(bird.months.every(m=>Number.isInteger(m)&&m>=1&&m<=12));
   assert.ok(!('recordCoordinates' in bird));
  }
 }
});
test('5.0 does not claim pretrained AI for real sounds or photos when no model is bundled',()=>{
 const p=JSON.parse(read('package.json')),html=read('app/index.html');
 assert.equal(p.version,'6.0.0');
 assert.match(p.build.nsis.artifactName,/6\.0/);
 assert.match(p.build.portable.artifactName,/6\.0/);
 assert.match(html,/Автоматического AI-распознавания/);
 assert.match(html,/Bird AI/);
});
