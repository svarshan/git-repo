'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');

test('audio player repeats only the selected fragment and clears it when the source changes',()=>{
 class Element {
  constructor(tag){this.tag=tag;this.children=[];this.listeners={};this.paused=true;this.currentTime=0;this.duration=20;this.value='';}
  appendChild(n){this.children.push(n);return n;}
  replaceChildren(...nodes){this.children=nodes;}
  setAttribute(){}
  addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
  emit(name){for(const fn of this.listeners[name]||[])fn({target:this});}
  pause(){this.paused=true;this.emit('pause');}
  play(){this.paused=false;this.emit('play');return Promise.resolve();}
 }
 const created=[];
 const context={document:{createElement:tag=>{const node=new Element(tag);created.push(node);return node;}},window:{},localStorage:{getItem:()=>null,setItem:()=>{}},setTimeout,Blob,URL};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../app/audio-pro.js'),'utf8'),context);
 const host=new Element('div');
 context.window.BirdAudioPro.mountCard(host,{name:'Птица',latin:'Testus birdus',audioFile:'media/audio/test.mp3',audioCredits:{}});
 const all=[];function walk(n){all.push(n);for(const x of n.children)walk(x);}walk(host);
 const audio=created.find(x=>x.tag==='audio');
 const button=text=>all.find(x=>x.tag==='button'&&x.textContent===text);
 assert.ok(audio);assert.ok(button('Начало фрагмента'));assert.ok(button('Конец фрагмента'));
 audio.currentTime=3;button('Начало фрагмента').emit('click');
 audio.currentTime=8;button('Конец фрагмента').emit('click');
 assert.equal(audio.currentTime,3);
 audio.currentTime=8;audio.emit('timeupdate');assert.equal(audio.currentTime,3);
 audio.emit('emptied');audio.currentTime=9;audio.emit('timeupdate');assert.equal(audio.currentTime,9);
});
