'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const core=require('../core20.js');
const sample=[{id:'g001',latin:'Boletus edulis',name:'Белый гриб',traits:'Коричневая шляпка',habitat:'Под берёзой',group:'Трубчатые'},
{id:'g002',latin:'Amanita phalloides',name:'Бледная поганка',traits:'Кольцо и вольва',habitat:'Лес',group:'Мухоморы',risk:'смертельно-ядовитый'}];
test('regional coordinate validation rejects imprecise and hidden records',()=>{
 const valid={id:10,latin:'Boletus edulis',lat:56.3,lon:44.1,grade:'research',source:'https://www.inaturalist.org/observations/10',obscured:false};
 const clean=core.cleanObservations([valid,{...valid,id:11,lat:90},{...valid,id:12,obscured:true},{...valid,id:13,grade:'casual'}]);
 assert.equal(clean.length,1);assert.equal(clean[0].id,10);
 const at=core.project(valid);assert.ok(at.x>0&&at.x<100&&at.y>0&&at.y<100);
});
test('species ranking is tentative and never marks food-safe',()=>{
 const matches=core.candidates(sample,{fields:{group:'Мухоморы'}});
 assert.equal(matches[0].bird.latin,'Amanita phalloides');
 assert.equal(matches[0].uncertain,true);
 assert.match(core.explainRisk(matches[0].bird),/опасный/);
 assert.match(core.explainRisk(sample[0]),/не подтверждение съедобности/);
});
test('photo provenance must be licensed and allow commercial reuse',()=>{
 const good={file:'media/gallery/Boletus_edulis-1.jpg',source:'https://www.inaturalist.org/photos/1',author:'Author',license:'CC-BY-SA'};
 assert.ok(core.eligiblePhoto(good));
 assert.equal(core.eligiblePhoto({...good,license:'CC-BY-NC'}),false);
 assert.equal(core.eligiblePhoto({...good,file:'https://outside.test/x.jpg'}),false);
 assert.equal(core.eligiblePhoto({...good,source:'https://attacker.test/x'}),false);
});
test('version 1.0 saved data can be restored safely',()=>{
 const x={schema:1,diary:[{speciesId:'g001',date:'2026-11-16',place:'Лес',notes:'плодовое тело'},
  {speciesId:'bad',date:'2026-11-16',place:'X'}],favorites:['g001','g001','bad']};
 const y=core.safeBackup(x,['g001']);
 assert.ok(y);assert.equal(y.diary.length,1);assert.deepEqual(y.favorites,['g001']);
 assert.equal(core.safeBackup({...x,schema:12},['g001']),null);
});
test('additive advanced field tools, GUI smoke, release artifact paths are present',()=>{
 const js=read('upgrade20.js'),html=read('index.html'),pkg=JSON.parse(read('package.json')),main=read('main.cjs'),reg=read('scripts/region_atlas20.py');
 for(const name of ['field20','id20','photo20','calendar20','geo20','stats20','anatomy20','protected20'])assert.ok(js.includes(name),name);
 assert.ok(js.includes('note='));assert.ok(js.includes('imageHistogram'));assert.ok(js.includes('safeBackup'));
 assert.ok(html.includes('region20.js')&&html.includes('core20.js')&&html.includes('upgrade20.js'));
 assert.equal(pkg.version,'3.4.0');assert.match(pkg.build.nsis.artifactName,/3\.4-Setup/);assert.match(pkg.build.portable.artifactName,/3\.4-Portable/);
 assert.ok(pkg.build.files.includes('media/gallery/**/*'));
 assert.match(main,/capturePage/);
 assert.match(reg,/quality_grade/);
});
