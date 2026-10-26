'use strict';
/* MoOLVa 7.8 pure validation and presentation helpers. No synthetic bird data. */
(function(factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(typeof window!=='undefined')window.MoOLVa78Core=api;
})(function(){
 const KEY_PREFIX='ptitsy-nn.';
 function evidence(scoreList){
  const top=(scoreList||[]).filter(x=>Number.isFinite(x?.score)).sort((a,b)=>b.score-a.score).slice(0,5);
  if(!top.length)return {status:'insufficient',message:'Достаточно убедительных модельных меток не найдено. Проверьте звук вручную.'};
  const ratio=top.length>1&&top[1].score>0?top[0].score/top[1].score:Infinity;
  if(ratio<1.18)return {status:'ambiguous',message:'Оценки двух кандидатов близки. На записи могут быть разные виды, шум или похожие позывки.'};
  return {status:'candidate',message:'Первый кандидат заметно выше остальных, но оценка модели не является вероятностью и требует проверки.'};
 }
 function sourceQuality(species,selectedMonths){
  const list=Array.isArray(species)?species:[];
  const sightings=list.reduce((n,x)=>n+Math.max(0,Number(x?.n)||0),0);
  const years=list.filter(x=>Number.isFinite(Number(x?.toYear))).map(x=>Number(x.toYear));
  const latest=years.length?Math.max(...years):null;
  return {sightings,latest,coverage:sightings>=60?'много записей':sightings>=12?'умеренно записей':sightings>0?'мало записей':'нет записей',
   note:'Опубликованные исторические записи · не прогноз присутствия и не координаты гнёзд'+(selectedMonths?' · фильтр по месяцам':'')};
 }
 function filterJournal(items,start,end,search){
  const q=String(search||'').trim().toLocaleLowerCase('ru').replace(/ё/g,'е');
  return (Array.isArray(items)?items:[]).filter(x=>{
   if(!x||typeof x.date!=='string')return false;
   const d=x.date.slice(0,10);
   if(start&&d<start)return false;
   if(end&&d>end)return false;
   return !q||String(x.place||'').toLocaleLowerCase('ru').replace(/ё/g,'е').includes(q)||String(x.notes||'').toLocaleLowerCase('ru').replace(/ё/g,'е').includes(q);
  });
 }
 function journalStats(items){
  const x=Array.isArray(items)?items:[];
  return {observations:x.length,species:new Set(x.map(t=>t.birdId).filter(Boolean)).size,
    locations:new Set(x.map(t=>String(t.place||'').trim()).filter(Boolean)).size,individuals:x.reduce((n,t)=>n+(Number.isFinite(+t.count)?Math.max(0,+t.count):0),0)};
 }
 function validStateArchive(x){
  if(!x||x.type!=='moolva-backup78'||x.version!==1||!x.stores||typeof x.stores!=='object'||Array.isArray(x.stores)||!Array.isArray(x.assets)||x.assets.length>20000)return false;
  const allowed=['ptitsy-nn.journal.v1','ptitsy-nn.favorites.v1','ptitsy-nn.recent.v1','ptitsy-nn.ui3.settings.v1','ptitsy-nn.sidebar.v76','ptitsy-nn.ui77.v1','ptitsy-nn.ui78.v1','ptitsy-nn.academy80.v1','ptitsy-nn.fieldmode80.v1','ptitsy-nn.expedition77.v1','ptitsy-nn.ai77.history.v1','ptitsy-nn.voice-lab.v1','ptitsy-nn.academy.sound.v5','ptitsy-nn.academy.v1'];
  return Object.keys(x.stores).every(k=>allowed.includes(k)&&typeof x.stores[k]==='string'&&x.stores[k].length<=8e6)&&
   x.assets.every(a=>a&&typeof a.id==='string'&&a.id.length<=160&&['photo','audio'].every(k=>a[k]==null||(typeof a[k]==='string'&&a[k].length<=8e6)));
 }
 return {evidence,sourceQuality,filterJournal,journalStats,validStateArchive,KEY_PREFIX};
});