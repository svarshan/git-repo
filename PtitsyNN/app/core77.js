'use strict';
/* Side-effect-free 7.7 search and grouped journal model. */
(function(factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(typeof window!=='undefined')window.MoOLVa77Core=api;
})(function(){
 function fold(s){return String(s||'').toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
 function search(birds,query,max=18){
  const q=fold(query),terms=q.split(' ').filter(Boolean);
  if(!terms.length)return[];
  return birds.map(b=>{
   const name=fold(b.name),latin=fold(b.latin),group=fold(b.group);
   const body=fold((b.description||'').slice(0,1400));
   if(!terms.every(t=>[name,latin,group,body].some(s=>s.includes(t))))return null;
   const points=terms.reduce((sum,t)=>sum+(name===t?12:name.startsWith(t)?9:name.includes(t)?6:latin.includes(t)?5:group.includes(t)?3:1),0);
   return {bird:b,points};
  }).filter(Boolean).sort((a,b)=>b.points-a.points||a.bird.name.localeCompare(b.bird.name,'ru')).slice(0,Math.min(40,Math.max(1,max)));
 }
 function groupEntries(items,labelMap){
  const map=new Map();
  for(const j of items||[]){
   if(!j||typeof j.id!=='string')continue;
   const label=String(labelMap?.[j.id]||j.place||'Без места').trim().slice(0,100)||'Без места';
   const arr=map.get(label)||[];arr.push(j);map.set(label,arr);
  }
  return [...map].map(([name,records])=>({name,records,types:new Set(records.map(r=>r.birdId)).size})).sort((a,b)=>b.records.length-a.records.length||a.name.localeCompare(b.name,'ru'));
 }
 function finiteScore(value){return typeof value==='number'&&Number.isFinite(value)?value:null;}
 return {fold,search,groupEntries,finiteScore};
});