'use strict';
(function(factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(typeof window!=='undefined')window.MoOLVa81Core=api;})(function(){
 const clean=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function comparison(a,b){
  if(!a||!b||a.id===b.id)return null;
  const genus=x=>String(x.latin||'').split(' ')[0];
  const type=genus(a)===genus(b)?'Один научный род':a.group===b.group?'Одна группа каталога':'Разные группы каталога';
  return {type,rows:[a,b].map(x=>({id:x.id,name:String(x.name||''),latin:String(x.latin||''),imageFile:x.imageFile||null,audioFile:x.audioFile||null,
   group:x.group||'',excerpt:String(x.description||'').slice(0,700),source:x.descriptionSource||null}))};
 }
 function windows(predictions){
  const timeline=[];
  for(const x of (predictions||[]).slice(0,8)){
   if(typeof x.label!=='string')continue;
   for(const v of (x.findings||[])){
    if(!Number.isFinite(v.offset)||v.offset<0||!Number.isFinite(v.score))continue;
    timeline.push({offset:v.offset,label:x.label,score:v.score});
   }
  }
  return timeline.sort((a,b)=>a.offset-b.offset||b.score-a.score).slice(0,80);
 }
 function seasonal(cells,bird,season='all',minReports=0){
  const seasons={winter:[12,1,2],spring:[3,4,5],summer:[6,7,8],autumn:[9,10,11]};
  const months=seasons[season]||[];
  return (Array.isArray(cells)?cells:[]).flatMap(c=>(c.species||[]).filter(x=>
   (!bird||bird==='all'||x.id===bird)&&Number(x.n||0)>=minReports&&(!months.length||(x.months||[]).some(m=>months.includes(m))))
   .map(x=>({id:x.id,n:Number(x.n)||0,fromYear:x.fromYear??null,toYear:x.toYear??null,lat:c.lat,lon:c.lon})));
 }
 function summarize(items,filter){
  const data=(Array.isArray(items)?items:[]).filter(x=>x&&typeof x.date==='string'&&typeof x.place==='string'&&
    (!filter?.start||x.date.slice(0,10)>=filter.start)&&(!filter?.end||x.date.slice(0,10)<=filter.end));
  const places=new Map(),birds=new Map();
  for(const x of data){const place=x.place.trim().slice(0,180);if(place)places.set(place,(places.get(place)||0)+1);
   if(x.birdId)birds.set(x.birdId,(birds.get(x.birdId)||0)+1);}
  return {total:data.length,places:[...places].sort((a,b)=>b[1]-a[1]).slice(0,70),birds:[...birds].sort((a,b)=>b[1]-a[1]).slice(0,150),rows:data.slice().sort((a,b)=>a.date.localeCompare(b.date)).slice(0,1000)};
 }
 function printableReport(rows,birds,options={}){
  const byId=new Map((birds||[]).map(x=>[x.id,x]));
  const stat=summarize(rows,options);
  const heading=clean(options.title||'Экспедиция MoOLVa'),date=new Date().toISOString().slice(0,10);
  const tr=stat.rows.map(x=>'<tr><td>'+clean(String(x.date||'').slice(0,25))+'</td><td>'+clean(byId.get(x.birdId)?.name||'Неизвестный вид')+'</td><td>'+clean(x.place.slice(0,180))+'</td><td>'+clean(Math.max(1,Math.min(99999,Number(x.count)||1)))+'</td><td>'+clean(String(x.notes||'').slice(0,500))+'</td></tr>').join('');
  return '<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>'+heading+'</title>'+
   '<style>body{font:14px Arial,sans-serif;color:#203347;margin:45px auto;max-width:1050px;padding:20px}h1{color:#1b4965}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #cfd9e4;padding:8px;text-align:left;vertical-align:top}th{background:#e2edf5}.intro{border-left:4px solid #8e2a23;padding:10px;background:#f6f9fc}@media print{body{margin:0;padding:12mm}}</style>'+
   '</head><body><h1>'+heading+'</h1><p class="intro">Полевой отчёт MoOLVa · '+date+' · записей: '+stat.total+' · видов: '+stat.birds.length+' · мест: '+stat.places.length+'. Маршрут — последовательность введённых мест, географические расстояния не вычислялись.</p>'+
   '<h2>Порядок остановок и наблюдения</h2><table><thead><tr><th>Дата</th><th>Вид</th><th>Место</th><th>Количество</th><th>Заметки</th></tr></thead><tbody>'+tr+'</tbody></table>'+
   '<p>Данные пользователя сохранены локально. Печатайте или сохраняйте этот HTML как PDF в браузере.</p></body></html>';
 }
 function audioIssues(pcm){
  if(!(pcm instanceof Float32Array)||pcm.length===0)return {usable:false,reason:'Нет PCM'};
  const step=Math.max(1,Math.ceil(pcm.length/5000)),n=Math.ceil(pcm.length/step);let rms=0,clipped=0,max=0;
  for(let i=0;i<pcm.length;i+=step){const x=pcm[i];if(!Number.isFinite(x))return {usable:false,reason:'Повреждённый PCM'};
   const a=Math.abs(x);rms+=x*x;max=Math.max(max,a);if(a>=.98)clipped++;}
  rms=Math.sqrt(rms/n);return {usable:rms>=.001&&clipped/n<.02,rms,peak:max,clipping:clipped/n,
   reason:rms<.001?'Слишком тихо':clipped/n>=.02?'Перегрузка записи':'Базовый уровень сигнала достаточен'};
 }
 return {clean,comparison,windows,seasonal,summarize,printableReport,audioIssues};
});