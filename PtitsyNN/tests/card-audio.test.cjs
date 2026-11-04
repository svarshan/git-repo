'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../app/app.js'),'utf8');
test('closing a bird card stops its inline players, managed audio and speech',()=>{
 const stop=source.slice(source.indexOf('function stop(){'),source.indexOf('\nfunction play('));
 const close=source.slice(source.indexOf('function close(){'),source.indexOf('\ndocument.addEventListener(',source.indexOf('function close(){')));
 const inline=[{currentTime:8,paused:false,pause(){this.paused=true;}},{currentTime:4,paused:false,pause(){this.paused=true;}}];
 const detached={currentTime:5,paused:false,pause(){this.paused=true;}};
 const overlay={hidden:false};let stopped=0,disposed=0,cancelled=0,removed=false;
 const context={window:{BirdAudioPro:{stopAll(){stopped++;}},BirdUltra:{closeAll(){disposed++;}},speechSynthesis:{}},document:{querySelectorAll(){return inline;},body:{classList:{remove(){removed=true;}}}},speechSynthesis:{cancel(){cancelled++;}},$(){return overlay;},currentAudio:detached,selected:'bird'};
 vm.createContext(context);vm.runInContext(stop+'\n'+close+'\nclose()',context);
 assert.equal(stopped,1);assert.equal(disposed,1);assert.equal(cancelled,1);assert.equal(overlay.hidden,true);assert.equal(removed,true);
 for(const a of [...inline,detached]){assert.equal(a.paused,true);assert.equal(a.currentTime,0);}
});
test('bird card places its playback before photograph and details',()=>{
 const start=source.indexOf("d.innerHTML='<div class=\"dialogbody\"><h2>");
 const end=source.indexOf('showDialog();window.BirdAudioPro?.mountCard',start);
 const card=source.slice(start,end);
 assert.ok(start>=0&&end>start);
 assert.ok(card.indexOf('id="birdAudioPro"')<card.indexOf('class="detailphoto"'));
 assert.ok(card.indexOf('id="birdAudioPro"')<card.indexOf("+passport+"));
});
