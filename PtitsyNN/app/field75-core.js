'use strict';
/* MoOLVa 7.5: deterministic, offline-only discovery helpers. No inferred occurrence claims. */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.MOOLVA75Core=api;
})(typeof window!=='undefined'?window:null,function(){
 const normalize=s=>String(s??'').toLocaleLowerCase('ru').replace(/ё/g,'е').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}\s-]/gu,' ').replace(/\s+/g,' ').trim();
 function distanceKm(a,b){
  const rad=Math.PI/180, lat1=Number(a?.lat),lat2=Number(b?.lat),lon1=Number(a?.lon),lon2=Number(b?.lon);
  if(![lat1,lat2,lon1,lon2].every(Number.isFinite))return Infinity;
  const dLat=(lat2-lat1)*rad,dLon=(lon2-lon1)*rad;
  const x=Math.sin(dLat/2)**2+Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin(dLon/2)**2;
  return 6371*2*Math.asin(Math.sqrt(Math.max(0,Math.min(1,x))));
 }
 const seasonMonths={all:[],winter:[12,1,2],spring:[3,4,5],summer:[6,7,8],autumn:[9,10,11]};
 function nearbyRecords(town,cells,birds,radius=70,season='all'){
  if(!town||!Array.isArray(cells)||!Array.isArray(birds))return [];
  const byId=new Map(birds.map(b=>[b.id,b]));const grouped=new Map(),allowed=seasonMonths[season]||[];
  for(const cell of cells){
   const distance=distanceKm(town,cell);
   if(distance>radius)continue;
   for(const record of (cell.species||[])){
    if(!byId.has(record.id))continue;
    if(allowed.length&&!(Array.isArray(record.months)&&record.months.some(m=>allowed.includes(m))))continue;
    const previous=grouped.get(record.id)||{bird:byId.get(record.id),zones:0,reports:0,nearestKm:Infinity};
    previous.zones++;previous.reports+=Math.max(0,Number(record.n)||0);
    previous.nearestKm=Math.min(previous.nearestKm,distance);
    grouped.set(record.id,previous);
   }
  }
  return [...grouped.values()].sort((a,b)=>b.zones-a.zones||b.reports-a.reports||a.bird.name.localeCompare(b.bird.name,'ru'));
 }
 function searchBirds(birds,query,limit=32){
  const terms=normalize(query).split(' ').filter(t=>t.length>1);
  if(!terms.length)return [];
  return birds.map(b=>{
   const names=normalize([b.name,b.latin,b.group].join(' '));
   const body=normalize((b.description||b.article||'').slice(0,3500));
   let score=0,matched=0;
   for(const term of terms){
    let partial=0;
    if(names.includes(term))partial=8;
    else if(body.includes(term))partial=2;
    if(partial)matched++;
    score+=partial;
   }
   return {bird:b,score,matched};
  }).filter(x=>x.matched===terms.length).sort((a,b)=>b.score-a.score||a.bird.name.localeCompare(b.bird.name,'ru')).slice(0,limit);
 }
 function validObservation(x,byId){
  return Boolean(x&&typeof x.id==='string'&&x.id.length>0&&x.id.length<=160&&byId.has(x.birdId)&&
   typeof x.date==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(x.date)&&
   typeof x.place==='string'&&x.place.trim().length>0&&x.place.length<=160&&
   Number.isInteger(x.count)&&x.count>0&&x.count<=99999&&typeof x.notes==='string'&&x.notes.length<=2000);
 }
 return {normalize,distanceKm,nearbyRecords,searchBirds,validObservation,seasonMonths};
});