'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=path.resolve(__dirname,'..');
const file=x=>fs.readFileSync(path.join(base,x),'utf8');
const html=file('app/index.html'),css=file('app/ui3.css'),js=file('app/ui3.js');
test('4.0 offline dashboard matches required layout and navigates to real pages',()=>{
 for(const id of ['catalog','field','favorites','compare','lab','journal','map','calendar','gallery','settings','articles','about']){
  assert.match(html,new RegExp('id="'+id+'"'),id);
 }
 for(const id of ['countAll','countAudio','countImages','countArticles','ui3-top-search','ui3-season-list','ui3-photo-list','ui3-gallery','habitatAtlas','ui3-calendar-grid','catalogList']){
  assert.match(html,new RegExp('id="'+id+'"'),id);
 }
 for(const action of ['catalogList','field-recent'])assert.ok(html.includes('data-jump="'+action+'"'));
 assert.match(html,/data-view="comparebirds6"/);
 assert.match(html,/href="ui3\.css"/);
 assert.match(html,/src="ui3\.js"/);
 assert.ok(html.indexOf('src="ui3.js"')>html.indexOf('src="app.js"'));
 assert.match(html,/MoOLVa 7\.0/);
});
test('dashboard relies on real species data and old user stores',()=>{
 assert.match(js,/window\.BIRDS_DATA/);
 assert.match(js,/birds\.filter\(b=>b\.audioFile\)/);
 assert.match(js,/birds\.filter\(b=>b\.imageFile\)/);
 assert.match(js,/birds\.filter\(b=>b\.articleComplete\)/);
 assert.match(js,/ptitsy-nn\.journal\.v1/);
 assert.match(js,/ptitsy-nn\.ui3\.settings\.v1/);
 assert.match(js,/escapeHtml\(b\.id\)/);
 assert.match(js,/escapeHtml\(b\.imageFile\)/);
 assert.match(css,/nizhny-night\.svg/);
 assert.match(css,/prefers-reduced-motion/);
 assert.match(html,/не прогноз текущего присутствия/);
 assert.match(html,/не точные места обитания или гнёзда/);
});
test('version 3.0 keeps installer and portable and does not load remote media',()=>{
 const p=JSON.parse(file('package.json'));
 const workflow=file('../.github/workflows/ptitsy-nn-windows.yml');
 assert.equal(p.version,'7.1.0');
 assert.ok(p.build.win.target.some(x=>x.target==='nsis'));
 assert.ok(p.build.win.target.some(x=>x.target==='portable'));
 assert.match(p.build.portable.artifactName,/7\.0/);
 assert.match(workflow,/Ptitsy-NN-7\.0-Windows/);
 assert.match(workflow,/node --check app\/ui3\.js/);
 assert.match(html,/connect-src 'none'/);
 assert.doesNotMatch(html,/<script[^>]+src="https?:/);
 new Function(js);
});


test('4.0 card badges report natural bird voice and article depth truthfully',()=>{
 const vm=require('node:vm');
 const context={window:{}};
 vm.runInNewContext(file('app/material-flags.js'),context);
 const api=context.window.BirdMaterialFlags;
 assert.ok(api && typeof api.flags==='function');
 const both=api.flags({audioFile:'media/audio/recording.mp3',articleComplete:true,description:'Длинное описание.'});
 assert.deepEqual(Array.from(both,x=>x.kind),['voice-yes','article-yes']);
 assert.match(api.markup({audioFile:'some.mp3',articleComplete:true}),/Голос птицы: есть/);
 assert.match(api.markup({audioFile:'some.mp3',articleComplete:true}),/Описание: подробное/);
 const missing=api.markup({audioFile:null,articleComplete:false,description:'Краткое описание.'});
 assert.match(missing,/Голос птицы: нет/);
 assert.match(missing,/Описание: краткое/);
 assert.ok(!missing.includes('Голос птицы: есть'));
 assert.equal(api.excerpt({description:'Птица гнездится в лесу.'},125),'Птица гнездится в лесу.');
 for(const name of ['app/app.js','app/ui3.js','app/field-assistant.js']){
  assert.match(file(name),/BirdMaterialFlags/,name);
 }
 assert.match(html,/src="material-flags\.js"/);
 assert.ok(html.indexOf('material-flags.js')<html.indexOf('field-assistant.js'));
 assert.match(css,/\.material-flag\.voice-yes/);
 assert.match(css,/\.material-flag\.article-brief/);
});
