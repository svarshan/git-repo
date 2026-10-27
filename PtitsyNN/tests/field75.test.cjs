'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const api=require('../app/field75-core.js');
const birds=[{id:'a',name:'Большая синица',latin:'Parus major',description:'Лесной вид',audioFile:'a.mp3'},{id:'b',name:'Белая трясогузка',latin:'Motacilla alba',description:'У водоёма'}];
test('8.1: accent-insensitive and data-grounded search',()=>{
 assert.equal(api.normalize('СИНИЦА, Ёж'),'синица еж');
 assert.equal(api.searchBirds(birds,'синица').length,1);
 assert.equal(api.searchBirds(birds,'Parus major')[0].bird.id,'a');
 assert.equal(api.searchBirds(birds,'несуществующее').length,0);
});
test('8.1: nearby sightings only within distance and actual months',()=>{
 const town={lat:56,lon:44},cells=[
 {lat:56.1,lon:44.1,species:[{id:'a',n:4,months:[12,1]},{id:'b',n:2,months:[7]}]},
 {lat:60,lon:44,species:[{id:'b',n:8,months:[12]}]}];
 let r=api.nearbyRecords(town,cells,birds,50,'winter');
 assert.equal(r.length,1);assert.equal(r[0].bird.id,'a');assert.equal(r[0].reports,4);
 assert.equal(api.nearbyRecords(town,cells,birds,5,'all').length,0);
 assert.equal(api.nearbyRecords(town,cells,birds,50,'summer')[0].bird.id,'b');
});
test('8.1: journal writes preserve legacy v1 schema',()=>{
 const map=new Map(birds.map(x=>[x.id,x]));
 const x={id:'entry-1',birdId:'a',date:'2026-10-25T15:00',place:'Бор',count:2,notes:'У воды'};
 assert.equal(api.validObservation(x,map),true);
 assert.equal(api.validObservation({...x,birdId:'forged'},map),false);
 assert.equal(api.validObservation({...x,count:0},map),false);
 assert.equal(api.validObservation({...x,notes:'x'.repeat(2001)},map),false);
});
