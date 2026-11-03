'use strict';
/* No network calls, no synthesised bird calls, no rewriting old reviews or media. */
(function(){
 const root=document.getElementById('media86'),core=window.MoOLVa86Core;
 if(!root||!core)return;
 const birds=Array.isArray(window.BIRDS_DATA)?window.BIRDS_DATA:[];
 const byId=new Map(birds.map(b=>[b.id,b]));
 const reviewKey='ptitsy-nn.media83.review.v1';
 const $=id=>document.getElementById(id);
 const node=(tag,txt,cls)=>{const n=document.createElement(tag);if(txt!==undefined&&txt!==null)n.textContent=String(txt);if(cls)n.className=cls;return n;};
 const btn=(label,fn)=>{const x=node('button',label);x.type='button';x.addEventListener('click',fn);return x;};
 const navigate=id=>document.querySelector('aside.sidebar [data-view="'+id+'"]')?.click();
 let quiz=null,score={right:0,total:0},page=0;
 function reviews(){try{return core.mediaReview(JSON.parse(localStorage.getItem(reviewKey)));}catch{return core.mediaReview(null);}}
 function message(t){$('m86Status').textContent=t;}
 function stat(){
  const s=core.summary(birds,reviews()),items=[['Видов',s.species],['Голосов',s.voices+'/'+s.target],
   ['Недостаёт',s.missing.length],['Фото',s.photos+'/'+s.target],
   ['Статей',s.articles+'/'+s.target],['Прослушано человеком',s.audioHuman],
   ['Фото подтверждено',s.photoHuman],['Сомнительных отметок',s.audioQuestioned+s.photoQuestioned]];
  const host=$('m86Stats');host.replaceChildren();
  for(const [label,value] of items){const x=node('div',null,'m86-stat');x.append(node('strong',value),node('small',label));host.append(x);}
  $('m86Scope').textContent='Наличие файла не означает подтверждение вида. Отметки ручной проверки независимы от технического аудита.';
 }
 function drawQueue(){
  const kind=$('m86Kind').value,filter=$('m86Filter').value,q=$('m86Search').value.trim().toLocaleLowerCase('ru').replace(/ё/g,'е');
  const rows=core.queue(birds,reviews(),kind,filter).filter(b=>(b.name+' '+b.latin).toLocaleLowerCase('ru').replace(/ё/g,'е').includes(q));
  const list=$('m86Queue');list.replaceChildren();
  const total=rows.length,start=page*20;
  if(start>=total&&page>0){page=0;return drawQueue();}
  for(const b of rows.slice(start,start+20)){
   const x=node('article',null,'m86-media-card');
   if(b.imageFile){const img=node('img');img.src=b.imageFile;img.alt='Фотография '+b.name;img.loading='lazy';x.append(img);}
   x.append(node('strong',b.name),node('small',b.latin));
   if(kind==='audio'&&b.audioFile){const player=node('audio');player.src=b.audioFile;player.controls=true;player.preload='none';x.append(player);}
   const credit=kind==='audio'?b.audioCredits:b.imageCredits;
   x.append(node('small',credit?(String(credit.author||'Автор не указан')+' · '+String(credit.license||'Лицензия не указана')):'Исходный файл отсутствует'));
   if(b.audioFile||b.imageFile)x.append(btn('Открыть контроль материалов',()=>{navigate('media83');$('m83Search').value=b.latin;$('m83Search').dispatchEvent(new Event('input'));}));
   if(!b.audioFile&&kind==='audio')x.append(node('small','Нужна настоящая запись с подходящей лицензией. Подмена запрещена.'));
   x.append(btn('Открыть паспорт',()=>document.dispatchEvent(new CustomEvent('living-open',{detail:b.id}))));
   list.append(x);
  }
  $('m86Page').textContent=(total?start+1:0)+'–'+Math.min(total,start+20)+' / '+total;
  $('m86Prev').disabled=page===0;$('m86Next').disabled=start+20>=total;
 }
 function drawHabitat(){
  const b=byId.get($('m86Bird').value),season=$('m86Season').value,host=$('m86Habitat');
  host.replaceChildren();if(!b)return;
  const ev=core.seasonEvidence(window.HABITAT_DATA?.cells||[],b.id,season);
  host.append(node('p',ev.zones?'Опубликованные наблюдения: '+ev.reports+' сообщений в '+ev.zones+' укрупнённых зонах.':'По выбранному сезону опубликованных данных нет. Это не означает отсутствие вида.'));
  if(ev.years.length)host.append(node('small','Годы источников: '+ev.years[0]+'–'+ev.years[ev.years.length-1]+'. Это история наблюдений, не прогноз.'));
  host.append(btn('Открыть карту вида',()=>{navigate('map');window.BirdHabitat?.focusSpecies?.(b.id);}));
 }
 function showAssessment(kind,items){
  const host=$('m86Model');host.replaceChildren();
  const ev=core.modelAssessment(items,birds);
  host.append(node('p',(kind==='voice'?'Аудиомодель: ':'Модель фотографии: ')+ev.note+(ev.ambiguous?' Несколько близких вариантов.':'')));
  for(const item of ev.candidates){
   const x=node('div',null,'m86-model-row');
   x.append(node('span',(item.bird?.name||item.label||'Неизвестный класс')+' · балл '+item.score.toFixed(3)));
   if(item.bird)x.append(btn('Паспорт',()=>document.dispatchEvent(new CustomEvent('living-open',{detail:item.bird.id}))));
   host.append(x);
  }
 }
 function renderQuiz(){
  const area=$('m86Quiz');area.replaceChildren();
  const pool=birds.filter(b=>Boolean(b.audioFile));
  if(pool.length<4){area.append(node('p','Недостаточно настоящих записей для тренажёра.'));return;}
  const idx=Math.floor(Math.random()*pool.length),bird=pool[idx],options=core.quizOptions(pool,bird.id,Math.floor(Math.random()*999));
  quiz={bird,answered:false};area.append(node('p','Прослушайте настоящую запись и выберите вид. Фотография скрыта до ответа.'));
  const audio=node('audio');audio.src=bird.audioFile;audio.controls=true;audio.preload='none';area.append(audio);
  const feedback=node('p',null,'m86-feedback'),choices=node('div',null,'m86-choices');
  for(const b of options){const button=btn(b.name,()=>{if(quiz.answered)return;quiz.answered=true;score.total++;
    if(b.id===bird.id){score.right++;feedback.textContent='Верно: '+bird.name+'.';}
    else feedback.textContent='Правильный вид в каталоге: '+bird.name+'. Ваш ответ: '+b.name+'. Проверьте первоисточник записи.';
    for(const el of choices.querySelectorAll('button'))el.disabled=true;
    const img=node('img');if(bird.imageFile){img.src=bird.imageFile;img.alt=bird.name;img.className='m86-quiz-photo';area.append(img);}
    area.append(btn('Следующий голос',renderQuiz));$('m86QuizScore').textContent=score.right+' / '+score.total;
   });choices.append(button);}
  area.append(choices,feedback);
 }
 function exportReport(){
  const report={type:'moolva-8.6-local-media-status',createdAt:new Date().toISOString(),notes:'Metadata and your review marks only. NOT an audio/media backup or expert verification.',summary:core.summary(birds,reviews()),review:reviews(),
   missing:birds.filter(b=>!b.audioFile).map(b=>({latin:b.latin,name:b.name}))};
  const file=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),url=URL.createObjectURL(file),a=node('a');
  a.href=url;a.download='MoOLVa-8.6-media-report.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
  message('Отчёт выгружен. Он не заменяет архив медиа и данных.');
 }
 function wire(){
  for(const b of birds.slice().sort((a,b)=>a.name.localeCompare(b.name,'ru'))){const o=node('option',b.name+' — '+b.latin);o.value=b.id;$('m86Bird').append(o);}
  for(const id of ['m86Kind','m86Filter','m86Search'])$(id).addEventListener(id==='m86Search'?'input':'change',()=>{page=0;drawQueue();});
  $('m86Prev').addEventListener('click',()=>{page=Math.max(0,page-1);drawQueue();});
  $('m86Next').addEventListener('click',()=>{page++;drawQueue();});
  for(const id of ['m86Bird','m86Season'])$(id).addEventListener('change',drawHabitat);
  $('m86QuizNew').addEventListener('click',renderQuiz);
  $('m86Backup').addEventListener('click',async()=>{
   const b=$('m86Backup');b.disabled=true;
   try{const r=await window.MoOLVaAutoBackup?.create('manual');
    if(!r?.saved)throw Error('Файл резервной копии не подтверждён');
    message('Локальный резервный архив создан: '+r.file+'. Историческая копия исходников хранится в GitHub.');}
   catch(e){message('Не удалось создать резервную копию: '+(e.message||e));}finally{b.disabled=false;}
  });
  $('m86VerifyBackups').addEventListener('click',()=>{navigate('media83');$('m83CheckBackups')?.click();});
  $('m86Export').addEventListener('click',exportReport);
  $('m86VoiceAI').addEventListener('click',()=>navigate('birdai'));
  $('m86VisionAI').addEventListener('click',()=>navigate('intelligence80'));
  $('m86Compare').addEventListener('click',()=>navigate('comparebirds6'));
  $('m86Compact').addEventListener('click',()=>$('m76Toggle')?.click());
  document.addEventListener('moolva-voice-predictions',e=>showAssessment('voice',e.detail));
  document.addEventListener('moolva-vision-predictions',e=>showAssessment('photo',e.detail?.top));
  document.querySelector('aside.sidebar [data-view="media86"]')?.addEventListener('click',()=>{stat();drawQueue();drawHabitat();});
  stat();drawQueue();drawHabitat();renderQuiz();
 }
 wire();
 window.MoOLVa86={refresh:()=>{stat();drawQueue();drawHabitat();}};
})();
