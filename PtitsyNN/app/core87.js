'use strict';
/* 8.7 is offline-first. Technical file checks never prove biological identity. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.MoOLVa87Core=api;})(typeof window!=='undefined'?window:null,function(){
 const TARGET=298;
 const alphabet={'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'i','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ы':'y','э':'e','ю':'yu','я':'ya','ь':'','ъ':''};
 function norm(value){return String(value||'').toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');}
 function latin(value){return norm(value).split('').map(x=>Object.prototype.hasOwnProperty.call(alphabet,x)?alphabet[x]:x).join('');}
 function tokens(value){return norm(value).split(' ').filter(Boolean);}
 function score(b,query){
  const terms=tokens(query);if(!terms.length)return 1;
  const name=norm(b.name),scientific=norm(b.latin),roman=latin(b.name);
  const group=norm(b.group),details=norm(String(b.description||'').slice(0,1800));
  let points=0;
  for(const term of terms){
   const t=latin(term);
   if(name===term||scientific===term||roman===t){points+=35;continue;}
   if(name.startsWith(term)||scientific.startsWith(term)||roman.startsWith(t)){points+=15;continue;}
   if(name.includes(term)||scientific.includes(term)||roman.includes(t)){points+=11;continue;}
   if(group.includes(term)){points+=4;continue;}
   if(term.length>=4&&details.includes(term)){points+=2;continue;}
   return 0;
  }
  return points;
 }
 function search(rows,query,limit=40){return (Array.isArray(rows)?rows:[]).map(b=>({bird:b,rank:score(b,query)})).filter(x=>x.rank>0).sort((a,b)=>b.rank-a.rank||String(a.bird.name).localeCompare(String(b.bird.name),'ru')).slice(0,Math.max(1,limit)).map(x=>x.bird);}
 function reviews(raw){
  if(!raw||raw.version!==1||typeof raw.audio!=='object'||typeof raw.photo!=='object'||!raw.audio||!raw.photo)return {version:1,audio:{},photo:{}};
  return {version:1,audio:{...raw.audio},photo:{...raw.photo}};
 }
 function triageEntry(quality,bird,kind){const q=quality&&quality[kind];return q&&q[bird.latin]||null;}
 function triagePriority(quality,bird,kind){return Number(triageEntry(quality,bird,kind)?.priority)||0;}
 function summary(birds,reviewRaw,quality){
  const list=Array.isArray(birds)?birds:[],mark=reviews(reviewRaw);
  return {target:TARGET,species:list.length,photos:list.filter(x=>!!x.imageFile).length,
   audio:list.filter(x=>!!x.audioFile).length,
   articles:list.filter(x=>!!x.articleComplete).length,
   audioMissing:list.filter(x=>!x.audioFile).map(x=>({name:x.name,latin:x.latin,id:x.id})),
   audioAwaiting:list.filter(x=>x.audioFile&&x.audioCredits?.reviewStatus==='awaiting-user-review').length,
   audioPersonalConfirmed:list.filter(x=>x.audioFile&&mark.audio[x.id]==='confirmed').length,
   audioPersonalQuestioned:list.filter(x=>x.audioFile&&mark.audio[x.id]==='questioned').length,
   photoPersonalConfirmed:list.filter(x=>x.imageFile&&mark.photo[x.id]==='confirmed').length,
   photoPersonalQuestioned:list.filter(x=>x.imageFile&&mark.photo[x.id]==='questioned').length,
   audioTechnicalFlags:list.filter(x=>x.audioFile&&triagePriority(quality,x,'audio')>0).length,
   photoVisualQueue:list.filter(x=>x.imageFile&&triagePriority(quality,x,'photo')>0).length};
 }
 function worklist(birds,raw,filter,query,quality){
  const mark=reviews(raw),list=search(birds,query,298);
  const f=b=>filter==='audit-priority'?!!b.audioFile&&mark.audio[b.id]!=='confirmed'&&triagePriority(quality,b,'audio')>0:
   filter==='missing'?!b.audioFile:
   filter==='audio-review'?!!b.audioFile&&mark.audio[b.id]!=='confirmed':
   filter==='questioned'?mark.audio[b.id]==='questioned'||mark.photo[b.id]==='questioned':
   filter==='photo-review'?!!b.imageFile&&mark.photo[b.id]!=='confirmed':
   filter==='new'?b.audioCredits?.reviewStatus==='awaiting-user-review':true;
  const result=list.filter(f);
  if(filter==='audit-priority'||filter==='audio-review')result.sort((a,b)=>triagePriority(quality,b,'audio')-triagePriority(quality,a,'audio'));
  if(filter==='photo-review')result.sort((a,b)=>triagePriority(quality,b,'photo')-triagePriority(quality,a,'photo'));
  return result;
 }
 function tracks(bird){
  const r=[];
  if(bird.audioFile)r.push({path:bird.audioFile,title:'Основная запись',credit:bird.audioCredits||{}});
  for(const t of Array.isArray(bird.audioTracks)?bird.audioTracks:[]){
   if(t&&typeof t.path==='string'&&t.path&&!r.some(a=>a.path===t.path))r.push({path:t.path,title:String(t.name||t.title||'Дополнительная запись'),credit:t.credit||{}});
  }
  return r;
 }
 function season(bird,cells,key,core){
  const evidence=core?.seasonEvidence?.(cells||[],bird.id,key);
  if(!evidence)return {zones:0,reports:0,years:[]};
  return {zones:evidence.zones,reports:evidence.reports,years:evidence.years,zoneLabels:evidence.zoneLabels||[]};
 }
 function nextCandidate(birds,bird){
  const genus=String(bird.latin||'').split(' ')[0];
  return (birds||[]).find(x=>x.id!==bird.id&&String(x.latin||'').split(' ')[0]===genus)
   ||(birds||[]).find(x=>x.id!==bird.id&&x.group===bird.group)||null;
 }
 return {TARGET,norm,latin,score,search,reviews,triageEntry,triagePriority,summary,worklist,tracks,season,nextCandidate};
});