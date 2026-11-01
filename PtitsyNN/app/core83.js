'use strict';
/* MoOLVa 8.3: deterministic offline search, genuine media provenance, mapped records. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.MoOLVa83Core=api;})(typeof window!=='undefined'?window:null,function(){
 const letters={а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'};
 const fold=x=>String(x??'').toLocaleLowerCase('ru').replace(/ё/g,'е').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}\s-]/gu,' ').replace(/\s+/g,' ').trim();
 const latinize=x=>fold(x).replace(/[а-я]/g,c=>letters[c]??c);
 function search(birds,query,filters={}){
  const terms=fold(query).split(/\s+/).filter(Boolean).slice(0,12),limit=Math.max(1,Math.min(298,Number(filters.limit)||298));
  return (Array.isArray(birds)?birds:[]).filter(b=>{
   if(filters.group==='other'&&b.group)return false;
   if(filters.group&&filters.group!=='all'&&filters.group!=='other'&&filters.group!==b.group)return false;
   if(filters.only==='audio'&&!b.audioFile)return false;
   if(filters.only==='image'&&!b.imageFile)return false;
   if(filters.only==='article'&&!b.articleComplete)return false;
   return true;
  }).map(b=>{
   const name=fold(b.name),latin=fold(b.latin),group=fold(b.group),desc=fold(b.description).slice(0,16000);
   const aliases=(Array.isArray(b.synonyms)?b.synonyms:[]).concat(Array.isArray(b.aliases)?b.aliases:[]).map(fold);
   const translit=latinize(b.name);
   let score=0;
   for(const term of terms){
    const q=latinize(term),match= name.includes(term)?12:latin.includes(term)?12:aliases.some(x=>x.includes(term))?9:translit.includes(q)?8:group.includes(term)?3:desc.includes(term)?1:0;
    if(!match)return null;score+=match;
   }
   if(terms.length&&name===terms.join(' '))score+=20;
   return {bird:b,score};
  }).filter(Boolean).sort((a,b)=>b.score-a.score||String(a.bird.name).localeCompare(String(b.bird.name),'ru')).slice(0,limit).map(x=>x.bird);
 }
 function mediaStatus(b,review={}){
  const photo=Boolean(b?.imageFile),audio=Boolean(b?.audioFile),p=review.photo?.[b?.id],a=review.audio?.[b?.id];
  return {photo,audio,photoHuman:p==='confirmed',audioHuman:a==='confirmed',photoQuestioned:p==='questioned',audioQuestioned:a==='questioned',
   photoSource:b?.imageCredits?.source||'',audioSource:b?.audioCredits?.source||'',
   photoLicense:b?.imageCredits?.license||'',audioLicense:b?.audioCredits?.license||''};
 }
 function distanceKm(lat1,lon1,lat2,lon2){
  const d=Math.PI/180,a=Math.sin((lat2-lat1)*d/2)**2+Math.cos(lat1*d)*Math.cos(lat2*d)*Math.sin((lon2-lon1)*d/2)**2;
  return 12742*Math.asin(Math.sqrt(Math.max(0,Math.min(1,a))));
 }
 const seasonMonths={all:[],winter:[12,1,2],spring:[3,4,5],summer:[6,7,8],autumn:[9,10,11]};
 function nearbyEvidence(cells,city,radius=70,season='all',birds=[]){
  if(!city||!Number.isFinite(Number(city.lat))||!Number.isFinite(Number(city.lon)))return [];
  const months=seasonMonths[season]||[],byId=new Map(birds.map(b=>[b.id,b])),rows=new Map();
  for(const cell of cells||[]){
   if(!Number.isFinite(Number(cell.lat))||!Number.isFinite(Number(cell.lon)))continue;
   if(distanceKm(Number(city.lat),Number(city.lon),Number(cell.lat),Number(cell.lon))>Math.max(1,Math.min(120,Number(radius)||70)))continue;
   for(const item of cell.species||[]){
    if(months.length&&!(item.months||[]).some(m=>months.includes(m)))continue;
    if(!byId.has(item.id)||!Number.isFinite(Number(item.n))||Number(item.n)<=0)continue;
    const state=rows.get(item.id)||{bird:byId.get(item.id),reports:0,zones:0};
    state.reports+=Number(item.n);state.zones++;rows.set(item.id,state);
   }
  }
  return [...rows.values()].sort((a,b)=>b.reports-a.reports||a.bird.name.localeCompare(b.bird.name,'ru'));
 }
 function validReview(x){
  if(!x||x.version!==1||!x.photo||!x.audio)return false;
  for(const kind of ['photo','audio'])if(typeof x[kind]!=='object'||Array.isArray(x[kind])||Object.keys(x[kind]).length>298||!Object.values(x[kind]).every(v=>v==='confirmed'||v==='questioned'))return false;
  return true;
 }
 return {fold,latinize,search,mediaStatus,nearbyEvidence,distanceKm,validReview,seasonMonths};
});
