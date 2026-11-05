'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const core=require('../app/core87.js');
const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const sample=[
 {id:'1',name:'Большая синица',latin:'Parus major',group:'Лесные птицы',description:'Жёлтая грудь',audioFile:'a.mp3',imageFile:'a.jpg',articleComplete:true,audioCredits:{reviewStatus:'awaiting-user-review',recordingId:'XC1'}},
 {id:'2',name:'Большой подорлик',latin:'Clanga clanga',group:'Хищные птицы',audioFile:'b.mp3',imageFile:'b.jpg',audioCredits:{recordingId:'XC371196'}},
 {id:'3',name:'Черноголовый хохотун',latin:'Ichthyaetus ichthyaetus',group:'Чайки',imageFile:'c.jpg'},
 {id:'4',name:'Малая синица',latin:'Parus minor',group:'Лесные птицы',audioFile:'d.mp3',imageFile:'d.jpg'}];
test('8.7 search understands Russian, transliteration, scientific names and descriptions',()=>{
 assert.equal(core.search(sample,'sinitsa')[0].id,'1');
 assert.equal(core.search(sample,'Clanga clanga')[0].id,'2');
 assert.equal(core.search(sample,'подорлик')[0].id,'2');
 assert.equal(core.search(sample,'жёлтая')[0].id,'1');
 assert.equal(core.search(sample,'unknown-something').length,0);
});
test('8.7 summary clearly separates file counts from personal reviews',()=>{
 const review={version:1,audio:{'1':'confirmed','2':'questioned','3':'confirmed'},photo:{'1':'confirmed'}};
 const s=core.summary(sample,review);
 assert.equal(s.target,298);assert.equal(s.species,4);assert.equal(s.audio,3);assert.equal(s.audioMissing.length,1);
 assert.equal(s.audioPersonalConfirmed,1);assert.equal(s.audioPersonalQuestioned,1);
 assert.equal(s.photoPersonalConfirmed,1);assert.equal(s.audioAwaiting,1);
});
test('8.7 audit filter never turns an unverified file into expert truth',()=>{
 const r={version:1,audio:{'1':'confirmed','2':'questioned'},photo:{'2':'questioned'}};
 assert.deepEqual(core.worklist(sample,r,'missing','').map(b=>b.id),['3']);
 assert.deepEqual(core.worklist(sample,r,'new','').map(b=>b.id),['1']);
 assert.deepEqual(core.worklist(sample,r,'questioned','').map(b=>b.id),['2']);
 assert.deepEqual(core.worklist(sample,r,'audio-review','').map(b=>b.id),['2','4']);
});
test('8.7 unique audio variants and source-scoped season evidence',()=>{
 const b={audioFile:'x.mp3',audioCredits:{author:'A'},audioTracks:[{path:'x.mp3',credit:{author:'B'}},{path:'y.mp3',credit:{author:'C'}}]};
 assert.deepEqual(core.tracks(b).map(x=>x.path),['x.mp3','y.mp3']);
 const ev=core.season(sample[0],[], 'winter',{seasonEvidence:()=>({zones:0,reports:0,years:[],zoneLabels:[]})});
 assert.equal(ev.zones,0);assert.equal(ev.reports,0);
 assert.equal(core.nextCandidate(sample,sample[0]).id,'4');
});
test('8.7 desktop release has original icon, QA cockpit, source backup, both EXEs and real screenshots',()=>{
 const pkg=JSON.parse(read('package.json')),html=read('app/index.html'),wf=read('../.github/workflows/ptitsy-nn-windows.yml'),main=read('main.cjs');
 assert.equal(pkg.version,'8.7.0');
 assert.equal(pkg.build.win.icon,'build/moolva.ico');
 assert.equal(pkg.build.nsis.artifactName,'MoOLVa-8.7-Setup-'+'$'+'{arch}.exe');
 assert.equal(pkg.build.portable.artifactName,'MoOLVa-8.7-Portable-'+'$'+'{arch}.exe');
 for(const id of ['media87','m87Kpis','m87Missing','m87Results','m87Bird','m87Season','m87Export','m87Backup'])assert.ok(html.includes('id="'+id+'"'),id);
 for(const name of ['core87.js','upgrade87.js','upgrade87.css'])assert.ok(html.includes(name),name);
 assert.ok(wf.includes('scripts/last_voice94.py'));
 assert.ok(wf.includes('voice_guard85.py'));
 assert.ok(wf.includes('Ptitsy-NN-8.7-Setup-only'));
 assert.ok(wf.includes('Ptitsy-NN-8.7-Portable-only'));
 assert.ok(main.includes("'08-pro-max-8.7.png','media87'"));
});
