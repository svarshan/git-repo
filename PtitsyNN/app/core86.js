'use strict';
/* MoOLVa 8.6: evidence-only operations. A downloaded file is NOT a human verified taxon. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.MoOLVa86Core=api;})(typeof window!=='undefined'?window:null,function(){
 const TAXA_GOAL=298;
 const seasons={all:[],winter:[12,1,2],spring:[3,4,5],summer:[6,7,8],autumn:[9,10,11]};
 function mediaReview(review){
  if(!review||review.version!==1||!review.audio||!review.photo)return {version:1,audio:{},photo:{}};
  return review;
 }
 function summary(birds,rawReview){
  const rows=Array.isArray(birds)?birds:[],review=mediaReview(rawReview);
  const voiced=rows.filter(b=>Boolean(b.audioFile)),photos=rows.filter(b=>Boolean(b.imageFile));
  const validAudio=new Set(voiced.map(b=>b.id)),validPhoto=new Set(photos.map(b=>b.id));
  return {target:TAXA_GOAL,species:rows.length,voices:voiced.length,missing:rows.filter(b=>!b.audioFile),
   photos:photos.length,articles:rows.filter(b=>Boolean(b.articleComplete)).length,
   audioHuman:Object.keys(review.audio).filter(id=>validAudio.has(id)&&review.audio[id]==='confirmed').length,
   photoHuman:Object.keys(review.photo).filter(id=>validPhoto.has(id)&&review.photo[id]==='confirmed').length,
   audioQuestioned:Object.keys(review.audio).filter(id=>validAudio.has(id)&&review.audio[id]==='questioned').length,
   photoQuestioned:Object.keys(review.photo).filter(id=>validPhoto.has(id)&&review.photo[id]==='questioned').length};
 }
 function queue(birds,rawReview,kind='audio',filter='pending'){
  if(!['audio','photo'].includes(kind))return [];
  const r=mediaReview(rawReview)[kind],file=kind==='audio'?'audioFile':'imageFile';
  return (Array.isArray(birds)?birds:[]).filter(b=>{
   if(filter==='missing')return !b[file];
   if(!b[file])return false;
   if(filter==='all')return true;
   if(filter==='confirmed')return r[b.id]==='confirmed';
   if(filter==='questioned')return r[b.id]==='questioned';
   return r[b.id]!=='confirmed';
  }).sort((a,b)=>String(a.name).localeCompare(String(b.name),'ru'));
 }
 function seasonEvidence(cells,birdId,season='all'){
  const months=seasons[season]||[],zones=[],years=new Set();
  for(const cell of Array.isArray(cells)?cells:[]){
   const hits=(cell.species||[]).filter(x=>x.id===birdId&&Number(x.n)>0&&
     (!months.length||(Array.isArray(x.months)&&x.months.some(m=>months.includes(Number(m))))));
   if(!hits.length)continue;
   const sum=hits.reduce((n,x)=>n+Number(x.n),0);
   for(const x of hits)for(let y=Number(x.fromYear);Number.isInteger(y)&&y<=Number(x.toYear)&&y<2100&&y>=1900;y++)years.add(y);
   zones.push({label:String(cell.name||cell.label||'Укрупнённая зона'),reports:sum});
  }
  return {zones:zones.length,reports:zones.reduce((a,z)=>a+z.reports,0),years:[...years].sort(),zoneLabels:zones.slice(0,12)};
 }
 function modelAssessment(items,birds,limit=5){
  const byLatin=new Map((birds||[]).map(b=>[String(b.latin||'').toLowerCase(),b]));
  const candidates=(Array.isArray(items)?items:[]).filter(x=>x&&Number.isFinite(Number(x.score))&&Number(x.score)>=0)
   .sort((a,b)=>Number(b.score)-Number(a.score)).slice(0,Math.max(1,Math.min(limit,8)))
   .map(x=>({score:Number(x.score),label:String(x.label||x.latin||''),bird:byLatin.get(String(x.label||x.latin||'').toLowerCase())||null}));
  const top=candidates[0]?.score||0,second=candidates[1]?.score||0;
  return {candidates,ambiguous:candidates.length>1&&(!top||second/top>0.85),
    note:'Оценки модели относительные и не являются вероятностями или экспертным определением вида.'};
 }
 function quizOptions(birds,answerId,offset=0){
  const list=(Array.isArray(birds)?birds:[]).filter(b=>b?.audioFile&&b?.id);
  const answer=list.find(b=>b.id===answerId);if(!answer||list.length<4)return [];
  const same=list.filter(b=>b.id!==answerId&&b.group===answer.group);
  const others=list.filter(b=>b.id!==answerId&&b.group!==answer.group);
  const rotate=(a,n)=>a.length?a.slice((n%a.length+a.length)%a.length).concat(a.slice(0,(n%a.length+a.length)%a.length)):[];
  const distractors=[...rotate(same,offset),...rotate(others,offset)].slice(0,3);
  const options=[answer,...distractors];
  const position=((offset%4)+4)%4;
  options.splice(0,1);options.splice(position,0,answer);
  return options;
 }
 function sourceSummary(b){
  const credit=b?.audioCredits||{};
  return {latin:String(b?.latin||''),author:String(credit.author||''),license:String(credit.license||''),source:String(credit.source||''),
   status:b?.audioFile?'file-present-not-human-verified':'missing'};
 }
 return {TAXA_GOAL,seasons,mediaReview,summary,queue,seasonEvidence,modelAssessment,quizOptions,sourceSummary};
});
