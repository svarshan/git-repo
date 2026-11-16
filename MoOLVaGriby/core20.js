'use strict';
(function(root,factory){const a=factory();if(typeof module==='object'&&module.exports)module.exports=a;if(root)root.MoOLVa20Core=a;})(typeof window!=='undefined'?window:null,function(){
 const range={latMin:54.1,latMax:58.2,lonMin:41.2,lonMax:48.2};
 const danger=['ядовитый','смертельно-ядовитый'];
 function safeSpecies(b){return b&&typeof b.latin==='string'&&/^[A-Z][a-z-]+ [a-z-]+$/.test(b.latin);}
 function cleanObservations(rows){return (Array.isArray(rows)?rows:[]).filter(o=>
  o&&safeSpecies({latin:o.latin})&&o.id&&o.source&&/^https:\/\/www\.inaturalist\.org\/observations\/\d+$/.test(o.source)&&
  !o.obscured&&Number.isFinite(o.lat)&&Number.isFinite(o.lon)&&o.lat>=range.latMin&&o.lat<=range.latMax&&o.lon>=range.lonMin&&o.lon<=range.lonMax&&
  o.grade==='research').slice(0,300);}
 function project(o){return {x:Math.max(0,Math.min(100,(o.lon-range.lonMin)/(range.lonMax-range.lonMin)*100)),
  y:Math.max(0,Math.min(100,(range.latMax-o.lat)/(range.latMax-range.latMin)*100))};}
 function seasonCounts(rows){const n=Array(12).fill(0);for(const o of rows||[]){const v=Number(o.month);if(Number.isInteger(v)&&v>=1&&v<=12)n[v-1]++;}return n;}
 function yearCounts(rows){const h=new Map();for(const x of rows||[]){const y=String(x.date||'').slice(0,4);if(/^(19|20)\d\d$/.test(y))h.set(y,(h.get(y)||0)+1);}return [...h].sort((a,b)=>a[0].localeCompare(b[0]));}
 function candidates(species,opts={}){
  const arr=Array.isArray(species)?species:[];
  const q=String(opts.query||'').toLowerCase().trim();
  const filters=Object.entries(opts.fields||{}).filter(([,x])=>x);
  return arr.map(b=>{let score=0,matched=[];
   for(const [k,v] of filters){const value=String(v).toLowerCase();
    const haystack=(k==='substrate'?String(b.habitat||''):k==='cap'?String(b.traits||''):k==='group'?String(b.group||''):String(b.traits||'')+' '+String(b.habitat||'')).toLowerCase();
    if(haystack.includes(value)){score+=3;matched.push(k);}else score-=2;
   }
   if(q&&String(b.name+' '+b.latin+' '+b.traits).toLowerCase().includes(q))score+=4;
   return {bird:b,score,matched,uncertain:true};}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,12);
 }
 function eligiblePhoto(x){return x&&/^media\/(photos|gallery)\/[A-Za-z0-9_-]+\.jpg$/.test(x.file)&&
  /^(cc0|cc-by|cc by|public domain|pd-)/i.test(x.license||'')&&!/(?:^|[- ])(?:nc|nd)(?:[- ]|$)/i.test(x.license||'')&&/^https:\/\/(www\.inaturalist\.org\/photos\/|commons\.wikimedia\.org\/wiki\/File:)/.test(x.source||'');}
 function quality(species,photos,gallery){const list=Array.isArray(species)?species:[],all=Object.values(photos||{}).filter(eligiblePhoto),bad=Object.values(photos||{}).length-all.length;
  return {species:list.length,photoSpecies:list.filter(x=>eligiblePhoto(photos?.[x.latin])).length,licenseRejected:bad,
   galleryFiles:Object.values(gallery||{}).flat().filter(eligiblePhoto).length,
   humanVisualVerified:0,missing:list.filter(x=>!eligiblePhoto(photos?.[x.latin])).map(x=>x.latin)};}
 function scoreColors(data,ref){if(!data||!ref||data.length!==ref.length)return 0;let sum=0;for(let i=0;i<data.length;i++)sum+=Math.min(Number(data[i])||0,Number(ref[i])||0);return sum;}
 function safeBackup(x,validIds){if(!x||x.schema!==1||!Array.isArray(x.diary)||!Array.isArray(x.favorites))return null;
   if(x.diary.length>1200||x.favorites.length>1000)return null;
   const allowed=new Set(validIds||[]);
   const diary=x.diary.filter(o=>o&&typeof o==='object'&&allowed.has(o.speciesId)&&typeof o.place==='string'&&o.place.length<=100&&typeof o.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(o.date)&&String(o.notes||'').length<=1000).slice(-1000);
   return {diary,favorites:[...new Set(x.favorites.filter(id=>allowed.has(id)))],schema:1};}
 function explainRisk(b){return danger.includes(b?.risk)?'Известно опасный вид; не использовать для еды':'Справочный или неизвестный риск. Это не подтверждение съедобности.';}
 function seasonalProbability(){return 'Недостаточно данных для прогноза. Показаны только опубликованные наблюдения.';}
 return {range,safeSpecies,cleanObservations,project,seasonCounts,yearCounts,candidates,eligiblePhoto,quality,scoreColors,safeBackup,explainRisk,seasonalProbability};
});
