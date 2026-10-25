'use strict';
/* MoOLVa 7.5: progressive enhancement of existing journal, maps and catalog; local only. */
(function(){
 const root=document.getElementById('pro75');if(!root||!window.MOOLVA75Core)return;
 const api=window.MOOLVA75Core,birds=Array.isArray(window.BIRDS_DATA)?window.BIRDS_DATA:[];
 const byId=new Map(birds.map(b=>[b.id,b]));
 const $=s=>root.querySelector(s);
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=String(text);if(cls)n.className=cls;return n;};
 const action=(label,fn)=>{const n=el('button',label,'living-button');n.type='button';n.addEventListener('click',fn);return n;};
 const openBird=id=>document.dispatchEvent(new CustomEvent('living-open',{detail:id}));
 const renderBird=(b,meta,container)=>{
  const card=el('article',null,'m75-species');
  if(b.imageFile){const img=el('img');img.src=b.imageFile;img.alt='Фотография '+b.name;img.loading='lazy';card.append(img);}
  const body=el('div',null,'m75-body');body.append(el('strong',b.name),el('small',b.latin||''));
  body.append(el('span',meta||((b.audioFile?'♪ Запись есть':'♪ Нет записи')+' · '+(b.articleComplete?'Есть статья':'Статья неполная'))));
  body.append(action('Паспорт вида',()=>openBird(b.id)));
  card.append(body);container.append(card);
 };
 // The catalog is the only authority for available images, licenses and descriptions.
 const searchForm=$('#m75SearchForm'),searchResults=$('#m75SearchResults');
 searchForm?.addEventListener('submit',e=>{
  e.preventDefault();searchResults.replaceChildren();
  const q=$('#m75Search').value.trim(),result=api.searchBirds(birds,q,30);
  searchResults.append(el('p',result.length?'Результаты по словам из каталога: '+result.length:'Совпадений нет. Уточните описание.','living-note'));
  for(const x of result)renderBird(x.bird,'Совпадение в названии или опубликованной статье',searchResults);
 });
 const missing=$('#m75Missing'),filter=$('#m75MissingSelect');
 function showMissing(){
  missing.replaceChildren();
  const mode=filter.value,arr=birds.filter(b=>mode==='audio'?!b.audioFile:mode==='photo'?!b.imageFile:!b.articleComplete);
  missing.append(el('p','Пока не заполнено: '+arr.length+' из '+birds.length+' видов. Источники не заменяются выдуманным содержимым.','living-note'));
  for(const b of arr.slice(0,30))renderBird(b,'Не хватает '+(mode==='audio'?'лицензированной записи':mode==='photo'?'фотографии':'полной статьи'),missing);
  if(arr.length>30)missing.append(el('p','Показаны первые 30 карточек.','living-note'));
 }
 filter?.addEventListener('change',showMissing);showMissing();
 // A location is a town centre; these counts are historic, spatially generalized GBIF reports.
 const towns=(window.BirdHabitat?.towns||[]).filter(t=>t?.name&&Number.isFinite(Number(t.lat))&&Number.isFinite(Number(t.lon)));
 const nearTown=$('#m75Town'),nearQuery=$('#m75TownFilter'),nearResults=$('#m75NearResults'),nearSeason=$('#m75Season'),nearRadius=$('#m75Radius');
 function updateTowns(){
  const q=api.normalize(nearQuery.value);
  const options=towns.filter(t=>api.normalize(t.name).includes(q)).sort((a,b)=>a.name.localeCompare(b.name,'ru')).slice(0,240);
  nearTown.replaceChildren();
  const placeholder=el('option','Выберите город или деревню');placeholder.value='';nearTown.append(placeholder);
  for(const t of options){const o=el('option',t.name);o.value=String(towns.indexOf(t));nearTown.append(o);}
 }
 function renderNear(){
  nearResults.replaceChildren();const town=towns[Number(nearTown.value)];
  if(!town||!nearTown.value){nearResults.textContent='Выберите населённый пункт.';return;}
  const rows=api.nearbyRecords(town,window.HABITAT_DATA?.cells||[],birds,Number(nearRadius.value)||70,nearSeason.value);
  nearResults.append(el('p','Исторические опубликованные данные: '+rows.length+' видов в обобщённых зонах до '+nearRadius.value+' км от центра '+town.name+'. Это не прогноз и не точные места гнёзд.','living-note'));
  nearResults.append(action('Показать населённый пункт на карте',()=>{
   document.querySelector('nav [data-view="map"]')?.click();window.BirdHabitat?.focusTown(town);
  }));
  for(const x of rows.slice(0,35))renderBird(x.bird,x.zones+' зон · '+x.reports+' записей · ближайшая ~'+Math.round(x.nearestKm)+' км',nearResults);
  if(!rows.length)nearResults.append(el('p','Для этого сезона опубликованных зон в выбранном радиусе нет. Отсутствие данных не доказывает отсутствие птиц.','living-note'));
  if(rows.length>35)nearResults.append(el('p','Показаны первые 35 видов.','living-note'));
 }
 nearQuery?.addEventListener('input',updateTowns);
 for(const c of [nearTown,nearSeason,nearRadius])c?.addEventListener('change',renderNear);
 updateTowns();
 // Explicit user-confirmed observations; no inferred Perch classifications are silently saved.
 const entryForm=$('#m75JournalForm'),birdSelect=$('#m75JournalBird'),notice=$('#m75JournalStatus');
 for(const b of [...birds].sort((a,b)=>a.name.localeCompare(b.name,'ru'))){const o=el('option',b.name);o.value=b.id;birdSelect.append(o);}
 const now=new Date(),local=new Date(now.getTime()-now.getTimezoneOffset()*60000);
 $('#m75JournalDate').value=local.toISOString().slice(0,16);
 entryForm?.addEventListener('submit',e=>{
  e.preventDefault();const entry={id:crypto.randomUUID?.()||String(Date.now()),birdId:birdSelect.value,date:$('#m75JournalDate').value,place:$('#m75JournalPlace').value.trim(),count:Number($('#m75JournalCount').value),notes:$('#m75JournalNotes').value.trim()};
  if(!api.validObservation(entry,byId)){notice.textContent='Проверьте все поля: дата, птица, место и количество.';return;}
  try{
   const old=JSON.parse(localStorage.getItem('ptitsy-nn.journal.v1')||'[]');
   if(!Array.isArray(old)||old.length>=20000)throw Error('Дневник переполнен или повреждён. Сначала сохраните резервную копию.');
   const updated=[...old,entry];localStorage.setItem('ptitsy-nn.journal.v1',JSON.stringify(updated));
   window.dispatchEvent(new Event('moolva75-journal-changed'));
   $('#m75JournalNotes').value='';notice.textContent='Наблюдение сохранено в прежнем дневнике. Рекомендуется периодически делать резервную копию.';
  }catch(err){notice.textContent='Не удалось сохранить: '+(err.message||err);}
 });
 const academy=$('#m75Academy'),exercise=$('#m75Exercise'),score=$('#m75AcademyScore'),level=$('#m75Level');
 const statsKey='ptitsy-nn.academy.pro75.v1',pool=birds.filter(b=>b.audioFile&&b.name),shuffle=a=>{const copy=a.slice();for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}return copy;};
 function scoreView(){let s={done:0,right:0};try{s={...s,...JSON.parse(localStorage.getItem(statsKey)||'{}')}}catch{}score.textContent='Вопросов: '+s.done+' · правильных: '+s.right+' · точность: '+(s.done?Math.round(100*s.right/s.done):0)+'%. Обучение хранится локально.';}
 function question(){
  exercise.replaceChildren();if(pool.length<4){exercise.textContent='Недостаточно доступных голосов для упражнения.';return;}
  const count=Number(level.value)||4,target=shuffle(pool)[0];
  const distractors=shuffle(pool.filter(b=>b.id!==target.id)).slice(0,Math.max(3,count-1));
  const options=shuffle([target,...distractors]);exercise.append(el('p','Прослушайте реальную запись и выберите правильный вид.','living-note'));
  const player=el('audio');player.controls=true;player.preload='none';player.src=target.audioFile;exercise.append(player);
  const list=el('div',null,'m75-quiz-options');exercise.append(list);
  const result=el('p');result.setAttribute('role','status');exercise.append(result);
  for(const b of options)list.append(action(b.name,()=>{
   player.pause();for(const button of list.querySelectorAll('button'))button.disabled=true;
   const correct=b.id===target.id;let s={done:0,right:0};try{s={...s,...JSON.parse(localStorage.getItem(statsKey)||'{}')}}catch{}
   s.done++;if(correct)s.right++;try{localStorage.setItem(statsKey,JSON.stringify(s))}catch{}
   scoreView();result.textContent=(correct?'Верно! ':'Это '+target.name+'. ')+'Проверяйте различия по паспортам и оригинальным голосам.';
   exercise.append(action('Паспорт правильного вида',()=>openBird(target.id)),action('Следующий вопрос',question));
  }));
 }
 level?.addEventListener('change',question);
 academy?.addEventListener('click',question);scoreView();question();
 // Safe health checks based on present local assets only. Do not imply manual Windows QA.
 $('#m75Diagnostic')?.addEventListener('click',async()=>{
  const box=$('#m75DiagnosticStatus'),imageCount=birds.filter(x=>x.imageFile).length,soundCount=birds.filter(x=>x.audioFile).length;
  box.textContent='Каталог: '+birds.length+' видов · фото: '+imageCount+' · записи: '+soundCount+'. Проверяю локальную модель…';
  try{const r=await window.BirdAI?.status?.();
   box.textContent+=' '+(r?.available?'Perch v2 доступен: '+(r.description||'ONNX готов'):'Perch v2 недоступен или не ответил. Нужна дополнительная диагностика.');}
  catch(e){box.textContent+=' Ошибка модуля: '+(e.message||e);}
 });
})();
