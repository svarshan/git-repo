'use strict';
(function(factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(typeof window!=='undefined')window.MoOLVa80Core=api;})(function(){
 const aliases={
 'HOUSE SPARROW':'Passer domesticus','TREE SPARROW':'Passer montanus','GREAT TIT':'Parus major',
 'EURASIAN BLUE TIT':'Cyanistes caeruleus','BLUE TIT':'Cyanistes caeruleus',
 'MALLARD DUCK':'Anas platyrhynchos','MALLARD':'Anas platyrhynchos',
 'EURASIAN ROBIN':'Erithacus rubecula','ROBIN':'Erithacus rubecula',
 'COMMON STARLING':'Sturnus vulgaris','EUROPEAN STARLING':'Sturnus vulgaris',
 'COMMON BLACKBIRD':'Turdus merula','BLACKBIRD':'Turdus merula',
 'COMMON KINGFISHER':'Alcedo atthis','KINGFISHER':'Alcedo atthis',
 'GRAY HERON':'Ardea cinerea','GREY HERON':'Ardea cinerea',
 'GOLDFINCH':'Carduelis carduelis','EUROPEAN GOLDFINCH':'Carduelis carduelis',
 'BARN SWALLOW':'Hirundo rustica','WHITE WAGTAIL':'Motacilla alba',
 'GREAT SPOTTED WOODPECKER':'Dendrocopos major','ROOK':'Corvus frugilegus',
 'EURASIAN JAY':'Garrulus glandarius','HOODED CROW':'Corvus cornix',
 'NORTHERN LAPWING':'Vanellus vanellus','COMMON SWIFT':'Apus apus',
 'EURASIAN MAGPIE':'Pica pica','MAGPIE':'Pica pica',
 'COMMON CUCKOO':'Cuculus canorus','EURASIAN WREN':'Troglodytes troglodytes'
 };
 const fold=t=>String(t||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 const isMatchLabel=(a,b)=>fold(a)===fold(b);
 function regionForLabel(label,birds){
  const latin=aliases[String(label||'').toUpperCase().trim()]||null;
  if(!latin)return null;
  const found=(birds||[]).find(x=>fold(x.latin)===fold(latin));
  return found||null;
 }
 function inferEvidence({birds,vision=[],voices=[],traits='',months=[],max=12}){
  const q=fold(traits),words=q.split(' ').filter(s=>s.length>2);
  const map=new Map((birds||[]).map(b=>[b.id,{bird:b,signals:[],points:0}]));
  for(const item of vision.slice(0,8)){
   const bird=regionForLabel(item.label,birds),row=bird&&map.get(bird.id);
   if(!row)continue;
   row.points+=5;row.signals.push('Модель фотографии: '+String(item.label).slice(0,70)+' (сопоставленный вид)');
  }
  for(const item of voices.slice(0,8)){
   const bird=(birds||[]).find(b=>isMatchLabel(b.latin,item.label)),row=bird&&map.get(bird.id);
   if(!row)continue;row.points+=4;row.signals.push('Распознавание по звуку: '+bird.latin+' (требует подтверждения)');
  }
  for(const row of map.values()){
   const text=fold([row.bird.name,row.bird.latin,row.bird.group,(row.bird.description||'').slice(0,3500)].join(' '));
   const matches=words.filter(x=>text.includes(x)).length;
   if(words.length&&matches===words.length){row.points+=2;row.signals.push('Все признаки найдены в опубликованном тексте');}
   // Seasons/occurrence are not scored as probability; only displayed as background evidence.
  }
  return [...map.values()].filter(x=>x.points>0).sort((a,b)=>b.points-a.points||a.bird.name.localeCompare(b.bird.name,'ru')).slice(0,max);
 }
 function journalOverview(items){
  const a=Array.isArray(items)?items.filter(x=>x&&typeof x.date==='string'):[];
  const byMonth=new Map(),byYear=new Map();
  for(const x of a){
   const y=x.date.slice(0,4),m=x.date.slice(0,7);if(!/^\d{4}-\d{2}$/.test(m))continue;
   byYear.set(y,(byYear.get(y)||0)+1);byMonth.set(m,(byMonth.get(m)||0)+1);
  }
  return {byYear:[...byYear].sort((a,b)=>a[0].localeCompare(b[0])),
   byMonth:[...byMonth].sort((a,b)=>a[0].localeCompare(b[0])),
   total:a.length,unique:new Set(a.map(x=>x.birdId)).size};
 }
 function quality(pcm){if(!(pcm instanceof Float32Array)||!pcm.length)return {ok:false,rms:0,peak:0};
  let peak=0,s=0,clipped=0;const step=Math.max(1,Math.floor(pcm.length/12000));let n=0;
  for(let i=0;i<pcm.length;i+=step){const v=pcm[i];if(!Number.isFinite(v))return {ok:false,rms:0,peak:0};const a=Math.abs(v);peak=Math.max(peak,a);s+=v*v;n++;if(a>=.98)clipped++;}
  const rms=Math.sqrt(s/n);return {ok:rms>=.001&&clipped/n<.02,rms,peak,clippingRatio:clipped/n,reason:rms<.001?'Очень тихая запись':clipped/n>=.02?'Возможно сильное искажение (клиппинг)':'Сигнал пригоден для теста; шум/различия видов этим не исключаются'};
 }
 return {fold,regionForLabel,inferEvidence,journalOverview,quality};
});