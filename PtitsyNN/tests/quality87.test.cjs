'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const core=require('../app/core87.js'),root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const birds=[{id:'a',latin:'A a',name:'Альфа',audioFile:'a.mp3',imageFile:'a.jpg'},
 {id:'b',latin:'B b',name:'Бета',audioFile:'b.mp3',imageFile:'b.jpg'},
 {id:'c',latin:'C c',name:'Гамма',audioFile:'c.mp3',imageFile:'c.jpg'}];
const q={audio:{'A a':{priority:20,flags:['possible_speech_review']},'B b':{priority:90,flags:['possible_duplicate']}},
 photo:{'C c':{priority:90,flags:['metadata_egg_or_nest_suspected']}}};
test('technical media flags prioritize review without claiming species proof',()=>{
 assert.equal(core.summary(birds,null,q).audioTechnicalFlags,2);
 assert.equal(core.summary(birds,null,q).photoVisualQueue,1);
 assert.deepEqual(core.worklist(birds,null,'audit-priority','',q).map(x=>x.id),['b','a']);
 assert.deepEqual(core.worklist(birds,null,'photo-review','',q).map(x=>x.id),['c','a','b']);
 assert.deepEqual(core.worklist(birds,{version:1,audio:{b:'confirmed'},photo:{}},'audit-priority','',q).map(x=>x.id),['a']);
});
test('offline triage is wired into existing interface and Windows release',()=>{
 const html=read('app/index.html'),u=read('app/upgrade87.js'),wf=read('../.github/workflows/ptitsy-nn-windows.yml');
 assert.ok(html.includes('quality-triage87.js'));
 assert.ok(html.includes('value="audit-priority"'));
 assert.ok(u.includes('MOOLVA_MEDIA_TRIAGE87'));
 assert.ok(wf.includes('python scripts/media_triage87.py'));
});
test('bird card uses one main player and old audio players can be freed',()=>{
 const js=read('app/app.js'),audio=read('app/audio-pro.js');
 assert.ok(js.includes('id="birdAudioPro"'));
 assert.ok(js.includes('Для прослушивания используйте основной плеер вверху карточки.'));
 assert.ok(!/const autoVoicePanel88[^;]*<audio /s.test(js));
 assert.ok(audio.includes('active.clear()'));
 assert.ok(audio.includes('active.add(audio)'));
});
