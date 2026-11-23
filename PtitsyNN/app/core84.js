'use strict';
/* MoOLVa 8.4: offline, source-grounded field search and AI candidate validation. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.MoOLVa84Core=api;})(typeof window!=='undefined'?window:null,function(){
 const normalize=s=>String(s??'').toLocaleLowerCase('ru').replace(/ё/g,'е').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
 const traits=['размер','клюв','оперен','окраска','крыл','хвост','лес','водоем','болот','поле','песн','голос','свист','желт','красн','черн','бел','сер','син','зелен','коричнев'];
 function findByTraits(birds,phrase,onlyAudio=false){
  const words=normalize(phrase).split(/\s+/).filter(x=>x.length>2).slice(0,8);
  if(!words.length)return [];
  return (Array.isArray(birds)?birds:[]).filter(b=>!onlyAudio||Boolean(b.audioFile))
   .map(b=>{
    const name=normalize([b.name,b.latin,b.group].join(' '));
    const description=normalize(b.description||'').slice(0,18000);
    let score=0;
    for(const term of words){
     if(name.includes(term))score+=12;
     else if(description.includes(term))score+=2;
     else return null;
    }
    return {bird:b,score};
   }).filter(Boolean).sort((a,b)=>b.score-a.score||a.bird.name.localeCompare(b.bird.name,'ru')).slice(0,30);
 }
 function historicalEvidence(cells,birdId,year){
  const filtered=[];
  for(const cell of cells||[]){
   for(const r of cell.species||[]){
    if(birdId&&r.id!==birdId)continue;
    const from=Number(r.fromYear),to=Number(r.toYear);
    if(year!=null&&(!Number.isInteger(from)||!Number.isInteger(to)||Number(year)<from||Number(year)>to))continue;
    if(!Number.isFinite(Number(r.n))||Number(r.n)<=0)continue;
    filtered.push({speciesId:r.id,reports:Number(r.n),fromYear:Number.isInteger(from)?from:null,toYear:Number.isInteger(to)?to:null});
   }
  }
  return filtered;
 }
 function modelEvidence(scores,limit=5){
  const top=(Array.isArray(scores)?scores:[]).filter(x=>Number.isFinite(Number(x.score))&&Number(x.score)>=0)
   .sort((a,b)=>Number(b.score)-Number(a.score)).slice(0,Math.max(1,Math.min(8,limit)));
  if(!top.length)return {top:[],ambiguous:true,message:'Нет данных модельного анализа'};
  const first=Number(top[0].score),second=top[1]?Number(top[1].score):0;
  const ambiguous=top.length>1&&(first===0||(second>0&&first/second<1.18));
  return {top,ambiguous,message:ambiguous?'Оценки близки: проверьте другие варианты и запись на слух.':'Первый кандидат лидирует, но модель не подтверждает присутствие вида.'};
 }
 function integrity(stats){
  const n=Array.isArray(stats)?stats:[];
  return {target:298,available:n.filter(b=>Boolean(b.audioFile)).length,missing:n.filter(b=>!b.audioFile).map(b=>({latin:b.latin,name:b.name})),
    photos:n.filter(b=>Boolean(b.imageFile)).length,articles:n.filter(b=>Boolean(b.articleComplete)).length};
 }
 return {normalize,traits,findByTraits,historicalEvidence,modelEvidence,integrity};
});
