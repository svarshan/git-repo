'use strict';
/* Offline audit desk. Review decisions are personal and are never uploaded.
   Built-in source metadata, FFmpeg quality status and human review are distinct. */
(function(){
const KEY='ptitsy-nn.voice-lab.v1';
const make=(type,cls,text)=>{const e=document.createElement(type);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e;};
const add=(p,...nodes)=>{nodes.forEach(n=>p.appendChild(n));return p;};
function state(){try{const x=JSON.parse(localStorage.getItem(KEY)||'{}');return x&&typeof x==='object'&&!Array.isArray(x)?x:{};}catch{return {};}}
function save(x){try{localStorage.setItem(KEY,JSON.stringify(x));return true;}catch{return false;}}
function download(data,name){
 const uri=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'}));
 const a=make('a');a.href=uri;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(uri),2000);
}
function entryId(b){return b.latin+'|'+((b.audioCredits||{}).source||'');}
function exportReview(birds){
 const reviews=state();
 const rows=birds.map(b=>({
  species:b.latin,name:b.name,recording:!!b.audioFile,
  source:(b.audioCredits||{}).source||null,
  rights:(b.audioCredits||{}).license||null,
  quality:(b.audioCredits||{}).audioQuality||null,
  reviewed:reviews[entryId(b)]||null
 }));
 download({project:'MoOLVa Birds NN 2.6',type:'manual-voice-review',date:new Date().toISOString(),
  note:'User judgments only, not professional species verification',rows},'moolva-voice-max-review.json');
}
function render(host,birds){
 if(!host)return;
 window.BirdAudioPro?.stopAll();
 host.replaceChildren();
 const sorted=[...birds].sort((a,b)=>a.name.localeCompare(b.name,'ru'));
 const records=state();
 const heading=make('div','voice-lab-head');
 const summary=make('p','voice-lab-summary','');
 const filter=make('select','voice-lab-filter');filter.setAttribute('aria-label','Фильтр записей');
 for(const [value,text] of [['all','Все виды'],['available','С записью'],['missing','Без записи'],['pending','Ожидают прослушивания'],['accepted','Отмечены подходящими'],['rejected','Отмечены проблемными']]){
  const option=make('option','',text);option.value=value;filter.appendChild(option);
 }
 const query=make('input','voice-lab-search');query.type='search';query.placeholder='Найти птицу или латинское имя';query.setAttribute('aria-label','Поиск');
 const exportButton=make('button','primary','Экспорт аудиоревизии JSON');exportButton.type='button';
 exportButton.addEventListener('click',()=>exportReview(sorted));
 add(heading,query,filter,exportButton);
 const listing=make('div','voice-lab-list');
 const detail=make('div','voice-lab-detail');
 const layout=add(make('div','voice-lab-layout'),listing,detail);
 add(host,summary,heading,layout);
 let currentId=null;
 const select=(bird)=>{
  currentId=bird.id;detail.replaceChildren();
  const title=make('h3','',bird.name+' · '+bird.latin);
  const credit=bird.audioCredits||{};
  const meta=make('p','voice-lab-muted',bird.audioFile?
   'Источник: '+(credit.source||'не указан')+'. Техническое качество: '+
   (credit.audioQuality?'проверено FFmpeg':'проверка недоступна')+'. Прослушивание человеком: '+(records[entryId(bird)]?.verdict||'не выполнено')+'.'
   :'Звук для этого вида пока не получен. Не подставляйте голос похожего вида.');
  add(detail,title,meta);
  const playerHost=make('div');
  detail.appendChild(playerHost);
  window.BirdAudioPro?.mountCard(playerHost,bird);
  if(!bird.audioFile)return;
  const buttons=make('div','voice-lab-review');
  const accepted=make('button','','✓ Запись подходит');
  const rejected=make('button','','✕ Есть проблема');
  const reset=make('button','','Сбросить оценку');
  const note=make('textarea','voice-lab-note');note.rows=2;note.maxLength=1500;note.placeholder='Что слышно? Какой недостаток?';
  const verdict=records[entryId(bird)];if(verdict)note.value=verdict.note||'';
  const label=make('p','voice-lab-muted','Сведения об источнике и громкости не доказывают, что записан нужный вид. Прослушайте звук перед оценкой.');
  const result=make('p','voice-lab-muted','');
  function update(value){
   if(value){
    records[entryId(bird)]={verdict:value,note:note.value.trim(),reviewedAt:new Date().toISOString()};
   }else delete records[entryId(bird)];
   result.textContent=save(records)?'Оценка сохранена только на этом компьютере':'Не удалось сохранить оценку';
   updateList();
  }
  accepted.addEventListener('click',()=>update('accepted'));
  rejected.addEventListener('click',()=>update('rejected'));
  reset.addEventListener('click',()=>update(null));
  add(buttons,accepted,rejected,reset);
  add(detail,buttons,note,label,result);
 };
 function updateList(){
  const q=query.value.trim().toLocaleLowerCase('ru').replaceAll('ё','е');
  let filtered=sorted.filter(b=>{
   if(q&&!(b.name+' '+b.latin).toLocaleLowerCase('ru').replaceAll('ё','е').includes(q))return false;
   const verdict=records[entryId(b)]?.verdict;
   return filter.value==='all'||(filter.value==='available'&&b.audioFile)||
    (filter.value==='missing'&&!b.audioFile)||
    (filter.value==='pending'&&b.audioFile&&!verdict)||
    (filter.value==='accepted'&&verdict==='accepted')||
    (filter.value==='rejected'&&verdict==='rejected');
  });
  const total=sorted.filter(b=>b.audioFile).length;
  const a=sorted.filter(b=>records[entryId(b)]?.verdict==='accepted').length;
  const r=sorted.filter(b=>records[entryId(b)]?.verdict==='rejected').length;
  summary.textContent='Виды: '+birds.length+' · Записи: '+total+' · Отсутствуют: '+(birds.length-total)+
   ' · Отмечены подходящими: '+a+' · Проблемные: '+r+
   ' · Не проверены вами: '+(total-a-r)+'.';
  listing.replaceChildren();
  for(const b of filtered){
   const verdict=records[entryId(b)]?.verdict;
   const status=!b.audioFile?'нет голоса':verdict==='accepted'?'оценено ✓':verdict==='rejected'?'проблема ✕':'не проверено';
   const button=make('button','voice-lab-bird'+(b.id===currentId?' selected':''),b.name+' · '+status);
   button.type='button';button.addEventListener('click',()=>{window.BirdAudioPro?.stopAll();select(b);updateList();});
   listing.appendChild(button);
  }
  if(filtered.length===0)listing.appendChild(make('p','voice-lab-muted','Нет видов по заданному фильтру'));
 }
 query.addEventListener('input',updateList);filter.addEventListener('change',updateList);
 updateList();if(sorted.length)select(sorted.find(b=>b.audioFile)||sorted[0]);
}
window.BirdVoiceLab={render,exportReview};
})();