'use strict';
(function(){
 const root=document.getElementById('intelligence80'),core=window.MoOLVa80Core;
 if(!root||!core)return;
 const birds=window.BIRDS_DATA||[],byId=new Map(birds.map(x=>[x.id,x]));
 const $=s=>document.querySelector(s),node=(tag,txt,cls)=>{const x=document.createElement(tag);if(txt!==undefined&&txt!==null)x.textContent=String(txt);if(cls)x.className=cls;return x;};
 const results=$('#m80Candidates'),visionBox=$('#m80VisionResults'),status=$('#m80VisionStatus'),photo=$('#m80Photo');
 let vision=[],voice=[],photoUrl=null;
 const openBird=b=>{const btn=node('button','Паспорт птицы','living-button');btn.type='button';
  btn.addEventListener('click',()=>document.dispatchEvent(new CustomEvent('living-open',{detail:b.id})));return btn;};
 async function availability(){
  try{const s=await window.BirdVision.status();status.textContent=s.description+' · модель на '+s.classCount+' классах; не все 298 видов области входят в обучение.';
   $('#m80VisionRun').disabled=!s.available||!photo?.files?.length;
  }catch(e){status.textContent='Bird Vision недоступен: '+(e.message||e);}
 }
 photo?.addEventListener('change',()=>{
  if(photoUrl){URL.revokeObjectURL(photoUrl);photoUrl=null;}vision=[];visionBox.replaceChildren();
  const f=photo.files?.[0],preview=$('#m80PhotoPreview');preview.replaceChildren();
  if(f&&['image/jpeg','image/png','image/webp'].includes(f.type)&&f.size<9*1048576){
   photoUrl=URL.createObjectURL(f);const img=node('img');img.src=photoUrl;img.alt='Локальное фото птицы';preview.append(img);
  }else if(f){status.textContent='Требуется JPEG, PNG или WebP до 9 МБ.';}
  availability();showResults();
 });
 $('#m80VisionRun')?.addEventListener('click',async()=>{
  const f=photo?.files?.[0];if(!f||!window.BirdVision)return;
  const btn=$('#m80VisionRun');btn.disabled=true;status.textContent='Вычисление настоящей ONNX-модели на компьютере…';
  try{
   const r=await window.BirdVision.predict(new Uint8Array(await f.arrayBuffer()));vision=Array.isArray(r.top)?r.top:[];
   if(!vision.length)throw Error('Модель не выдала классы');
   status.textContent='Распознавание завершено · классификатор обучен на внешних 525 видах. Логиты не являются вероятностями.';
   visionBox.replaceChildren();
   for(const item of vision.slice(0,5)){
    const matched=core.regionForLabel(item.label,birds),line=node('div',null,'m80-line');
    line.append(node('strong',item.label),node('small','Оценка: '+item.score.toFixed(3)+(matched?' · Региональный вид: '+matched.name:' · региональное соответствие не установлено')));
    if(matched)line.append(openBird(matched));visionBox.append(line);
   }
   showResults();
  }catch(e){status.textContent='Ошибка реальной модели: '+(e.message||e);}
  finally{btn.disabled=false;}
 });
 document.addEventListener('moolva-voice-predictions',e=>{
  voice=Array.isArray(e.detail)?e.detail.slice(0,8):[];
  $('#m80VoiceStatus').textContent='Кандидаты из последнего анализа Bird AI: '+voice.length+' · проверяйте на слух.';
  showResults();
 });
 $('#m80VoiceOpen')?.addEventListener('click',()=>document.querySelector('aside.sidebar [data-view="birdai"]')?.click());
 function showResults(){
  results.replaceChildren();
  const candidates=core.inferEvidence({birds,vision,voices:voice,traits:$('#m80Traits')?.value||'',max:12});
  if(!candidates.length){results.append(node('p','Введите признаки или загрузите результаты анализа. Нельзя уверенно определить птицу при недостатке данных.','living-note'));return;}
  results.append(node('p','Баллы отражают число совпадений источников, а не вероятность вида.','living-note'));
  for(const item of candidates){
   const bird=item.bird,card=node('article',null,'m80-species');
   if(bird.imageFile){const img=node('img');img.src=bird.imageFile;img.alt=bird.name;img.loading='lazy';card.append(img);}
   const info=node('div',null,'m80-species-info');info.append(node('strong',bird.name),node('small',bird.latin+' · '+item.points+' баллов'),
    node('p',item.signals.join(' · '),'living-note'));
   const actions=node('div',null,'m80-actions');actions.append(openBird(bird));
   const map=node('button','На карте','living-button');map.addEventListener('click',()=>window.BirdHabitat?.focusSpecies(bird.id));
   const journal=node('button','В дневник','living-button');journal.addEventListener('click',()=>{
    document.querySelector('aside.sidebar [data-view="pro75"]')?.click();
    const select=$('#m75JournalBird'),notes=$('#m75JournalNotes');
    if(select)select.value=bird.id;
    if(notes)notes.value='Кандидат на проверку: '+bird.name+' — источник определения MoOLVa 8.0.';
    $('#m75JournalPlace')?.focus();
   });
   actions.append(map,journal);info.append(actions);card.append(info);results.append(card);
  }
 }
 $('#m80Traits')?.addEventListener('input',showResults);
 // Real coarsened GBIF observations, never real-time predictions.
 const place=$('#m80Town'),near=$('#m80Nearby');
 function loadTowns(){
  const list=window.BirdHabitat?.towns||window.MOOLVA_SETTLEMENTS||[];
  const seen=new Set();
  for(let i=0;i<list.length;i++){const t=list[i];if(!t?.name||!Number.isFinite(+t.lat)||!Number.isFinite(+t.lon))continue;
   const k=core.fold(t.name);if(seen.has(k))continue;seen.add(k);
   const o=node('option',t.name);o.value=String(i);place.append(o);
  }
 }
 function renderNearby(){
  near.replaceChildren();const list=window.BirdHabitat?.towns||window.MOOLVA_SETTLEMENTS||[],selected=list[Number(place?.value)];
  if(!selected||!window.MOOLVA75Core)return;
  const found=window.MOOLVA75Core.nearbyRecords(selected,window.HABITAT_DATA?.cells||[],birds,70,$('#m80Season')?.value||'all');
  near.append(node('p','Опубликованные укрупнённые наблюдения в пределах 70 км: '+found.length+' видов. Не прогноз текущего присутствия.','living-note'));
  for(const r of found.slice(0,12)){
   const line=node('div',null,'m80-line');
   line.append(node('strong',r.bird.name),node('small','Зон: '+r.zones+' · исторических сообщений: '+r.reports+' · ближайшая зона ~'+Math.round(r.nearestKm)+' км'),openBird(r.bird));
   near.append(line);
  }
 }
 place?.addEventListener('change',renderNearby);$('#m80Season')?.addEventListener('change',renderNearby);
 const mode=$('#m80FieldMode');try{mode.checked=localStorage.getItem('ptitsy-nn.fieldmode80.v1')==='1';}catch{}
 document.body.classList.toggle('m80-field-mode',!!mode?.checked);
 mode?.addEventListener('change',()=>{document.body.classList.toggle('m80-field-mode',mode.checked);try{localStorage.setItem('ptitsy-nn.fieldmode80.v1',mode.checked?'1':'0');}catch{}});
 function journalRows(){try{const x=JSON.parse(localStorage.getItem('ptitsy-nn.journal.v1')||'[]');return Array.isArray(x)?x:[];}catch{return[];}}
 function renderJournal(){
  const x=core.journalOverview(journalRows()),report=$('#m80DiaryReport');report.replaceChildren();
  report.append(node('p','Записей: '+x.total+' · отмечено видов: '+x.unique,'living-note'));
  const row=node('div',null,'m80-stats');for(const [year,n] of x.byYear.slice(-10)){const item=node('div',null,'m80-stat');item.append(node('strong',year),node('small',n+' встреч'));row.append(item);}report.append(row);
  report.append(node('p','Последние месяцы: '+(x.byMonth.slice(-7).map(([m,n])=>m+': '+n).join(' · ')||'нет данных'),'living-note'));
 }
 $('#m80DiaryRefresh')?.addEventListener('click',renderJournal);
 $('#m80DiaryCSV')?.addEventListener('click',()=>{
  const x=core.journalOverview(journalRows()),csv='\ufeffГод;Наблюдений\r\n'+x.byYear.map(a=>a.join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=node('a');a.href=url;a.download='MoOLVa-8.0-diary-summary.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
 });
 document.addEventListener('click',e=>{if(e.target.closest?.('[data-view="journal"],[data-view="intelligence80"]'))queueMicrotask(renderJournal);});
 // Existing original quizzes preserved; Academy 4.0 adds a new graded practice track.
 const academy=$('#m80Academy');let score={asked:0,correct:0,streak:0,best:0},playing=null;
 try{const saved=JSON.parse(localStorage.getItem('ptitsy-nn.academy80.v1')||'{}');if(saved&&typeof saved==='object')score={...score,...saved};}catch{}
 function random(pool){return pool[Math.floor(Math.random()*pool.length)];}
 function practice(){
  if(playing){playing.pause();playing=null;}academy.replaceChildren();
  const type=$('#m80AcademyMode').value,hard=$('#m80AcademyLevel').value==='hard';
  const valid=birds.filter(x=>type==='photo'?x.imageFile:x.audioFile),answer=random(valid);
  if(!answer)return;
  let pool=valid.filter(x=>x.id!==answer.id&&(!hard||x.group===answer.group));
  if(pool.length<3)pool=valid.filter(x=>x.id!==answer.id);
  const options=pool.sort(()=>Math.random()-.5).slice(0,3).concat(answer).sort(()=>Math.random()-.5);
  academy.append(node('p',type==='photo'?'Определите птицу по лицензированной фотографии':'Определите птицу по реальной записи','living-note'));
  if(type==='photo'){const img=node('img');img.src=answer.imageFile;img.alt='Фото для проверки знаний';img.className='m80-academy-img';academy.append(img);}
  else{const audio=node('audio');audio.src=answer.audioFile;audio.controls=true;audio.preload='none';playing=audio;academy.append(audio);}
  const btns=node('div',null,'m80-choices'),res=node('p','','living-note');academy.append(btns,res);
  for(const b of options){const btn=node('button',b.name,'living-button');btns.append(btn);
   btn.addEventListener('click',()=>{
    const correct=b.id===answer.id;score.asked++;if(correct)score.correct++;
    score.streak=correct?score.streak+1:0;score.best=Math.max(score.best,score.streak);
    try{localStorage.setItem('ptitsy-nn.academy80.v1',JSON.stringify(score));}catch{}
    [...btns.children].forEach(c=>c.disabled=true);
    res.textContent=(correct?'Верно: ':'Правильный ответ: ')+answer.name+' · '+score.correct+'/'+score.asked+' · рекорд серии '+score.best;
    academy.append(openBird(answer));
    const next=node('button','Следующий вопрос','living-button');next.addEventListener('click',practice);academy.append(next);
   });
  }
 }
 $('#m80AcademyMode')?.addEventListener('change',practice);$('#m80AcademyLevel')?.addEventListener('change',practice);
 $('#m80AcademyReset')?.addEventListener('click',()=>{if(confirm('Сбросить только достижения Академии 8.0?')){score={asked:0,correct:0,streak:0,best:0};try{localStorage.removeItem('ptitsy-nn.academy80.v1');}catch{}practice();}});
 const perf=$('#m80Performance');if(perf)perf.textContent='Офлайн-каталог '+birds.length+' видов · ориентировочное время после навигации: '+Math.round(performance.now())+' мс. Для точного измерения используется Windows CI.';
 availability();loadTowns();renderNearby();showResults();renderJournal();practice();
 window.addEventListener('beforeunload',()=>{if(photoUrl)URL.revokeObjectURL(photoUrl);playing?.pause();});
})();