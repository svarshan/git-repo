'use strict';
/* MoOLVa 8.7 PRO MAX: additions to the existing offline atlas, not a replacement. */
(function(){
 const root=document.getElementById('media87'),core=window.MoOLVa87Core;
 if(!root||!core)return;
 const birds=Array.isArray(window.BIRDS_DATA)?window.BIRDS_DATA:[];
 const $=id=>document.getElementById(id);
 const node=(tag,value,cls)=>{const n=document.createElement(tag);if(value!==undefined&&value!==null)n.textContent=String(value);if(cls)n.className=cls;return n;};
 const button=(value,fn)=>{const n=node('button',value);n.type='button';n.addEventListener('click',fn);return n;};
 const REVIEW='ptitsy-nn.media83.review.v1',PAGE_SIZE=16;
 const note='Наличие аудиофайла, правильное латинское имя и техническое качество не доказывают, что голос принадлежит нужной птице.';
 let page=0,selected=null;
 const read=()=>{try{return core.reviews(JSON.parse(localStorage.getItem(REVIEW)));}catch{return core.reviews(null);}};
 function write(kind,bird,mark){
  try{const review=read();if(mark)review[kind][bird.id]=mark;else delete review[kind][bird.id];
   localStorage.setItem(REVIEW,JSON.stringify(review));status('Личная отметка сохранена. Она не является экспертной сертификацией.');render();
  }catch{status('Не удалось сохранить отметку');}
 }
 function status(value){const t=$('m87Status');if(t)t.textContent=value;}
 function jump(view){document.querySelector('aside.sidebar [data-view="'+view+'"]')?.click();}
 function openBird(bird){document.dispatchEvent(new CustomEvent('living-open',{detail:bird.id}));}
 function saveJSON(payload,filename){
  const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
  const a=node('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
 }
 function stats(){
  const s=core.summary(birds,read());const box=$('m87Kpis');box.replaceChildren();
  for(const [key,value] of [['Видов',s.species],['Фотографий',s.photos],['Записей',s.audio+'/'+s.target],
   ['Без звука',s.audioMissing.length],['Новых без прослушивания',s.audioAwaiting],['Фото с замечаниями',s.photoPersonalQuestioned]]){
   const x=node('div',null,'m87-kpi');x.append(node('strong',value),node('small',key));box.append(x);
  }
  const missing=$('m87Missing');missing.replaceChildren();
  if(!s.audioMissing.length)missing.append(node('p','Все 298 видов имеют основной аудиофайл. Подлинность голосов всё равно требует проверки.'));
  for(const b of s.audioMissing){
   const item=node('div',null,'m87-note');item.append(node('strong',b.name+' · '+b.latin));
   item.append(node('p','Подтверждённой записи в каталоге пока нет. Голос другого вида не подставляется.'));
   item.append(button('Открыть паспорт',()=>openBird(birds.find(x=>x.id===b.id))));missing.append(item);
  }
  $('m87AudioStatus').textContent='С вашими отметками: '+s.audioPersonalConfirmed+' «подходит», '+s.audioPersonalQuestioned+' «сомнительно». Прослушивание человеком не подтверждено автоматическими тестами.';
 }
 function stopLocal(){
  root.querySelectorAll('audio').forEach(a=>{try{a.pause();a.currentTime=0;}catch{}});
  window.BirdAudioPro?.stopAll?.();
 }
 function mediaCard(b,review){
  const card=node('article',null,'m87-bird');
  if(b.imageFile){const photo=node('img');photo.src=b.imageFile;photo.alt='Каталожная фотография '+b.name;photo.loading='lazy';card.append(photo);}
  else card.append(node('p','Фото отсутствует','m87-muted'));
  card.append(node('strong',b.name),node('small',b.latin+' · '+(b.group||'Группа не указана')));
  const tags=node('div',null,'m87-tags');
  tags.append(node('span',b.audioFile?'Файл голоса есть':'Голос отсутствует'));
  if(b.audioCredits?.reviewStatus==='awaiting-user-review')tags.append(node('span','Проверьте новый звук'));
  if(review.audio[b.id]==='questioned'||review.photo[b.id]==='questioned')tags.append(node('span','Есть замечание'));
  card.append(tags);
  if(b.audioFile){
   const tracks=core.tracks(b);
   if(tracks.length>1){
    const choose=node('select');choose.setAttribute('aria-label','Вариант голоса '+b.name);
    for(const t of tracks){const opt=node('option',t.title);opt.value=t.path;choose.append(opt);}
    card.append(choose);
    const audio=node('audio');audio.controls=true;audio.preload='none';audio.src=choose.value;
    choose.addEventListener('change',()=>{audio.pause();audio.src=choose.value;audio.load();});
    card.append(audio);
   }else{
    const audio=node('audio');audio.controls=true;audio.preload='none';audio.src=b.audioFile;audio.setAttribute('aria-label','Голос '+b.name);card.append(audio);
   }
   const credit=b.audioCredits||{};
   card.append(node('small',(credit.author||'Автор не указан')+' · '+(credit.license||'Лицензия не указана')));
   if(credit.source&&/^https:\/\/(xeno-canto\.org|commons\.wikimedia\.org|www\.inaturalist\.org|www\.freesound\.org|archive\.org)\//.test(credit.source)){
    const a=node('a','Источник записи');a.href=credit.source;a.target='_blank';a.rel='noopener noreferrer';card.append(a);
   }
  }else card.append(node('p','Подлинный голос пока не найден','m87-muted'));
  const actions=node('div',null,'m87-buttons');
  if(b.audioFile){
   actions.append(button('✓ Прослушал: подходит',()=>write('audio',b,'confirmed')));
   actions.append(button('! Голос сомнителен',()=>write('audio',b,'questioned')));
  }
  if(b.imageFile){
   actions.append(button('✓ Фото подходит',()=>write('photo',b,'confirmed')));
   actions.append(button('! Ошибка фото',()=>write('photo',b,'questioned')));
  }
  actions.append(button('Открыть паспорт',()=>openBird(b)));
  card.append(actions);return card;
 }
 function render(){
  const review=read(),rows=core.worklist(birds,review,$('m87Filter').value,$('m87Search').value);
  const total=rows.length,count=Math.ceil(total/PAGE_SIZE);page=Math.min(page,Math.max(0,count-1));
  const slice=rows.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
  const host=$('m87Results');stopLocal();host.replaceChildren(...slice.map(b=>mediaCard(b,review)));
  if(!slice.length)host.append(node('p','Ничего не найдено. Попробуйте другой фильтр.','m87-muted'));
  $('m87Page').textContent=total?(page*PAGE_SIZE+1)+'–'+Math.min((page+1)*PAGE_SIZE,total)+' / '+total:'0 / 0';
  $('m87Prev').disabled=page===0;$('m87Next').disabled=page>=count-1;stats();
 }
 function map(){
  const bird=birds.find(b=>b.id===$('m87Bird').value);if(!bird)return;
  const info=core.season(bird,window.HABITAT_DATA?.cells||[],$('m87Season').value,window.MoOLVa86Core);
  const host=$('m87MapResult');host.replaceChildren();
  if(info.zones){
   host.append(node('p','По опубликованным данным: '+info.reports+' наблюдений в '+info.zones+' укрупнённых зонах.'));
   if(info.years.length)host.append(node('small','Годы наблюдений: '+info.years[0]+'–'+info.years[info.years.length-1]));
   const list=node('ul',null,'m87-map-list');for(const z of info.zoneLabels)list.append(node('li',z.label+' — '+z.reports));host.append(list);
  }else host.append(node('p','Опубликованных наблюдений для выбранного сезона нет. Это не доказывает отсутствие птицы.'));
 }
 function exportReport(){
  const s=core.summary(birds,read());
  const report={app:'MoOLVa 8.7 PRO MAX',schema:1,createdAt:new Date().toISOString(),
    warning:'Metadata and personal ratings only. Technical acceptance is NOT species verification, and this is not a backup of the audio files.',
    summary:s,personalReview:read(),media:birds.map(b=>({id:b.id,latin:b.latin,name:b.name,photo:!!b.imageFile,
      voice:!!b.audioFile,recordingId:b.audioCredits?.recordingId||null,
      voiceSource:b.audioCredits?.source||null,license:b.audioCredits?.license||null,
      newUnreviewed:b.audioCredits?.reviewStatus==='awaiting-user-review'}))};
  saveJSON(report,'MoOLVa-8.7-media-review.json');status('Отчёт создан. Это не архив медиа и не экспертная проверка.');
 }
 function boot(){
  for(const b of birds.slice().sort((x,y)=>x.name.localeCompare(y.name,'ru'))){const opt=node('option',b.name+' · '+b.latin);opt.value=b.id;$('m87Bird').append(opt);}
  $('m87Bird').value=(birds.find(b=>b.latin==='Ichthyaetus ichthyaetus')||birds[0]||{}).id||'';
  $('m87Search').addEventListener('input',()=>{page=0;render();});
  $('m87Filter').addEventListener('change',()=>{page=0;render();});
  $('m87Prev').addEventListener('click',()=>{page=Math.max(0,page-1);render();});
  $('m87Next').addEventListener('click',()=>{page++;render();});
  $('m87Season').addEventListener('change',map);$('m87Bird').addEventListener('change',map);
  $('m87OpenMap').addEventListener('click',()=>{jump('map');window.BirdHabitat?.focusSpecies?.($('m87Bird').value);});
  $('m87Export').addEventListener('click',exportReport);
  $('m87Backup').addEventListener('click',async()=>{const control=$('m87Backup');control.disabled=true;try{const outcome=await window.MoOLVaAutoBackup?.create('manual');if(!outcome?.saved)throw new Error('Архив не подтверждён');status('Локальная резервная копия подтверждена. Исходники отдельно сохранены в резервной ветке GitHub.');}catch{status('Локальная резервная копия не подтверждена. Проверьте доступность папки сохранения.');}finally{control.disabled=false;}});
  $('m87PhotoQueue').addEventListener('click',()=>{$('m87Filter').value='photo-review';page=0;render();});
  $('m87VoiceQueue').addEventListener('click',()=>{$('m87Filter').value='new';page=0;render();});
  $('m87Compare').addEventListener('click',()=>{const b=birds.find(x=>x.id===$('m87Bird').value);if(b)window.MoOLVaCompare6?.selectSpecies?.(b.id);else jump('comparebirds6');});
  $('m87BirdAI').addEventListener('click',()=>jump('birdai'));
  $('m87PhotoAI').addEventListener('click',()=>jump('photoid'));
  root.addEventListener('play',ev=>{if(ev.target.tagName==='AUDIO'){window.BirdAudioPro?.stopAll?.();for(const other of root.querySelectorAll('audio'))if(other!==ev.target)other.pause();}},true);
  document.addEventListener('click',ev=>{const next=ev.target.closest('[data-view]');if(next&&next.dataset.view!=='media87')stopLocal();});
  render();map();status(note);
 }
 if(birds.length)boot();
})();