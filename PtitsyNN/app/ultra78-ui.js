'use strict';
/* MoOLVa 7.8: optional field tools on existing pages, no remote requests. */
(function(){
 const core=window.MoOLVa78Core,all=window.BIRDS_DATA||[],byId=new Map(all.map(b=>[b.id,b]));
 if(!core)return;
 const $=s=>document.querySelector(s);
 const mk=(tag,text,cls)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=String(text);return n;};
 const uiKey='ptitsy-nn.ui78.v1';
 let settings={font:100,card:'normal'};
 try{const x=JSON.parse(localStorage.getItem(uiKey)||'{}');if(x&&typeof x==='object'){
  if(Number.isFinite(x.font))settings.font=Math.max(90,Math.min(130,x.font));
  if(['normal','large'].includes(x.card))settings.card=x.card;
 }}catch{}
 function applySettings(){
  document.body.style.setProperty('--m78-font-scale',(settings.font/100).toFixed(2));
  document.body.classList.toggle('m78-large-cards',settings.card==='large');
  if($('#m78Font'))$('#m78Font').value=String(settings.font);
  if($('#m78FontLabel'))$('#m78FontLabel').textContent=settings.font+'%';
  if($('#m78Cards'))$('#m78Cards').value=settings.card;
 }
 function persist(){try{localStorage.setItem(uiKey,JSON.stringify(settings));}catch{}applySettings();}
 $('#m78Font')?.addEventListener('input',e=>{settings.font=Number(e.target.value);persist();});
 $('#m78Cards')?.addEventListener('change',e=>{settings.card=e.target.value;persist();});
 applySettings();
 // Species source panel: quotes only from an actual species description, never synthesized morphology.
 const birdSelect=$('#m78Species'),tabs=$('#m78SpeciesTabs'),body=$('#m78SpeciesPanel');
 if(birdSelect&&tabs&&body){
  for(const b of all.slice().sort((a,b)=>a.name.localeCompare(b.name,'ru'))){
   const option=mk('option',b.name+' — '+b.latin);option.value=b.id;birdSelect.append(option);
  }
  let tab='description';
  const ids=['description','identify','similar','season'];
  const labels={description:'Статья',identify:'Как отличить',similar:'Похожие виды',season:'Где и когда'};
  function renderSpecies(){
   const b=byId.get(birdSelect.value);if(!b)return;body.replaceChildren();
   for(const button of tabs.querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.tab===tab));
   const zones=(window.HABITAT_DATA?.cells||[]).filter(x=>(x.species||[]).some(s=>s.id===b.id));
   if(tab==='description'){
    body.append(mk('h3',b.name+' · '+b.latin));
    body.append(mk('p',b.description||'Полная статья пока отсутствует.','m78-article-text'));
    if(b.descriptionSource){
     const link=mk('a','Оригинальный источник описания');link.href=b.descriptionSource;link.target='_blank';link.rel='noopener noreferrer';body.append(link);
    }
   }else if(tab==='identify'){
    const intro=mk('p','Ниже — выдержка из опубликованного описания, а не автоматически придуманные определительные признаки.');
    const paragraphs=String(b.description||'').split(/\n\s*\n/).filter(Boolean);
    const keys=/окрас|оперен|размер|длин[аы]|клюв|хвост|крыл|отлича|похож|пени|голос|внешн|бел[а-я]*|черн[а-я]*/i;
    const found=paragraphs.filter(p=>keys.test(p)).slice(0,3);
    body.append(intro,mk('p',found.length?found.join('\n\n').slice(0,2200):'В подтверждённом тексте не удалось выделить подходящий фрагмент. Откройте исходную статью.','m78-article-text'));
   }else if(tab==='similar'){
    const genus=String(b.latin||'').split(' ')[0];
    const candidates=all.filter(x=>x.id!==b.id&&String(x.latin||'').split(' ')[0]===genus).slice(0,12);
    body.append(mk('p','Близость по роду — подсказка для сравнения, не доказательство внешнего сходства.','living-note'));
    for(const candidate of candidates){
     const button=mk('button',candidate.name+' — '+candidate.latin,'living-button');button.type='button';
     button.addEventListener('click',()=>{document.querySelector('button[data-view="comparebirds6"]')?.click();
      const a=$('#speciesCompareA'),other=$('#speciesCompareB');
      if(a&&other){a.value=b.id;other.value=candidate.id;a.dispatchEvent(new Event('change'));}});
     body.append(button);
    }
    if(!candidates.length)body.append(mk('p','В офлайн-каталоге нет другого вида из этого рода.','living-note'));
   }else{
    const records=zones.flatMap(c=>(c.species||[]).filter(s=>s.id===b.id));
    const months=[...new Set(records.flatMap(x=>x.months||[]))].sort((a,b)=>a-b);
    body.append(mk('p','Укрупнённых исторических зон: '+zones.length+'. Месяцы с опубликованными данными: '+(months.join(', ')||'нет данных')+'.','living-note'));
    body.append(mk('p','Карта не подтверждает присутствие вида в данный момент и скрывает точные координаты гнёзд.','living-note'));
    const button=mk('button','Открыть на карте','living-button');button.type='button';button.addEventListener('click',()=>window.BirdHabitat?.focusSpecies(b.id));body.append(button);
   }
  }
  tabs.addEventListener('click',e=>{const b=e.target.closest('button[data-tab]');if(!b||!ids.includes(b.dataset.tab))return;tab=b.dataset.tab;renderSpecies();});
  birdSelect.addEventListener('change',renderSpecies);
  if(all[0]){birdSelect.value=all[0].id;renderSpecies();}
  const lightbox=$('#m78Lightbox'),photo=$('#m78LightboxImage');
  function dismiss(){if(lightbox)lightbox.hidden=true;if(photo)photo.removeAttribute('src');}
  $('#m78PhotoOpen')?.addEventListener('click',()=>{
   const bird=byId.get(birdSelect.value);
   if(!bird?.imageFile){const panel=$('#m78SpeciesPanel');if(panel)panel.append(mk('p','Лицензированная фотография не обнаружена.','living-note'));return;}
   if(photo&&lightbox){photo.src=bird.imageFile;photo.alt='Птица '+bird.name;lightbox.hidden=false;}
  });
  $('#m78LightboxClose')?.addEventListener('click',dismiss);
  lightbox?.addEventListener('click',e=>{if(e.target===lightbox)dismiss();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&lightbox&&!lightbox.hidden)dismiss();});
 }
 // Field notebook: date filters and grounded local stats, separate from existing legacy journal sort/search.
 const from=$('#m78From'),to=$('#m78To'),stats=$('#m78JournalStats'),list=$('#m78JournalList');
 function updateJournal(){
  if(!stats||!list)return;let entries=[];
  try{const p=JSON.parse(localStorage.getItem('ptitsy-nn.journal.v1')||'[]');if(Array.isArray(p))entries=p;}catch{}
  const filtered=core.filterJournal(entries,from?.value,to?.value,$('#m78JournalText')?.value);
  const counts=core.journalStats(filtered);stats.textContent='Встреч: '+counts.observations+' · Видов: '+counts.species+' · Мест: '+counts.locations+' · Птиц отмечено: '+counts.individuals;
  list.replaceChildren();
  for(const record of filtered.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,80)){
   const row=mk('article',null,'m78-note');
   row.append(mk('strong',byId.get(record.birdId)?.name||'Птица'),mk('span',String(record.date||'').replace('T',' ')+' · '+String(record.place||'')));
   if(record.notes)row.append(mk('p',String(record.notes).slice(0,180)));
   list.append(row);
  }
  if(filtered.length>80)list.append(mk('p','Показаны первые 80 встреч. Используйте фильтры дат.','living-note'));
 }
 for(const id of ['m78From','m78To','m78JournalText'])$('#'+id)?.addEventListener('input',updateJournal);
 window.addEventListener('moolva75-journal-changed',updateJournal);
 document.addEventListener('click',e=>{if(e.target.closest?.('[data-view="journal"],[data-view="expedition"],[data-remove],[data-edit],#newObservation'))queueMicrotask(updateJournal);});
 updateJournal();
 // Grounded atlas dataset confidence in observation density and last documented year.
 const summary=$('#m78MapQuality');
 function updateMap(){
  if(!summary)return;
  const species=$('#habitatSpecies')?.value||'all',month=Number($('#habitatMonth')?.value)||0,season=$('#habitatSeason')?.value||'all';
  const monthSets={winter:[12,1,2],spring:[3,4,5],summer:[6,7,8],autumn:[9,10,11]};
  const group=$('#m77HabitatGroup')?.value||'all';
  const selected=(window.HABITAT_DATA?.cells||[]).flatMap(c=>(c.species||[]).filter(s=>{
   const bird=byId.get(s.id);return bird&&(species==='all'||s.id===species)&&(group==='all'||bird.group===group)&&
    (!month||(s.months||[]).includes(month))&&(season==='all'||(s.months||[]).some(m=>(monthSets[season]||[]).includes(m)));
  }));
  const q=core.sourceQuality(selected,month||season!=='all');
  summary.textContent='Опубликованные наблюдения: '+q.sightings+' · Достаточность выборки: '+q.coverage+
  (q.latest?' · последний год в отобранных данных: '+q.latest:' · дата последних наблюдений неизвестна')+'. '+q.note+'.';
 }
 $('#map')?.addEventListener('change',updateMap);
 document.addEventListener('click',e=>{if(e.target.closest?.('[data-view="map"],#m77SeasonPresets,#habitatSelectClear'))queueMicrotask(updateMap);});
 updateMap();
 // Real dual-track audio comparison: separate HTML5 player speeds and independent per-track real-time analysers.
 const selectors=[$('#m78VoiceA'),$('#m78VoiceB')],audios=[$('#m78AudioA'),$('#m78AudioB')],canvases=[$('#m78SpectrumA'),$('#m78SpectrumB')];
 const voices=all.filter(b=>b.audioFile).sort((a,b)=>a.name.localeCompare(b.name,'ru'));
 for(const s of selectors)if(s){for(const b of voices){const item=mk('option',b.name);item.value=b.id;s.append(item);}}
 let context=null,active=[],frames=[];
 function stopVisuals(){for(const id of frames)cancelAnimationFrame(id);frames=[];for(const el of active)el?.disconnect?.();active=[];}
 function loadAudio(index){
  const b=byId.get(selectors[index]?.value);const a=audios[index];if(!a)return;
  a.pause();a.removeAttribute('src');if(b?.audioFile)a.src=b.audioFile;a.load();
  a.playbackRate=Number($('#m78Rate')?.value)||1;
  const credit=$('#m78Credit'+(index?'B':'A'));
  if(credit)credit.textContent=b?.audioCredits?'Источник: '+String(b.audioCredits.source||'не указан')+' · лицензия: '+String(b.audioCredits.license||'см. паспорт вида'):'Проверенной записи нет';
 }
 selectors[0]?.addEventListener('change',()=>loadAudio(0));selectors[1]?.addEventListener('change',()=>loadAudio(1));
 $('#m78Rate')?.addEventListener('change',e=>{for(const a of audios)if(a)a.playbackRate=Number(e.target.value)||1;});
 if(voices.length){selectors[0].value=voices[0].id;selectors[1].value=(voices[1]||voices[0]).id;loadAudio(0);loadAudio(1);}
 // A browser AudioContext may be started only after explicit user play.
 function visualize(i){
  const audio=audios[i],canvas=canvases[i];if(!audio||!canvas)return;
  if(!context)context=new (window.AudioContext||window.webkitAudioContext)();
  const source=context.createMediaElementSource(audio),analyzer=context.createAnalyser();
  analyzer.fftSize=1024;source.connect(analyzer);analyzer.connect(context.destination);active[i]=analyzer;
  const ctx=canvas.getContext('2d'),bins=new Uint8Array(analyzer.frequencyBinCount);
  function frame(){
   if(audio.paused){frames[i]=0;return;}
   analyzer.getByteFrequencyData(bins);
   ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#59c4f0';
   const count=100,width=canvas.width/count;
   for(let k=0;k<count;k++){
    const p=Math.floor(k*bins.length/count),h=bins[p]/255*canvas.height;
    ctx.fillRect(k*width,canvas.height-h,Math.max(1,width-1),h);
   }
   frames[i]=requestAnimationFrame(frame);
  }
  frame();
 }
 const initialized=[false,false];
 audios.forEach((a,i)=>a?.addEventListener('play',()=>{
  if(!initialized[i]){try{visualize(i);initialized[i]=true;}catch(err){const c=$('#m78Credit'+(i?'B':'A'));if(c)c.textContent+=' · спектр недоступен: '+err.message;}}
  else{
   const c=canvases[i],an=active[i],ctx=c?.getContext('2d');
   const values=an?new Uint8Array(an.frequencyBinCount):null;
   const render=()=>{if(a.paused||!c||!an||!ctx)return;an.getByteFrequencyData(values);ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle='#59c4f0';
    for(let j=0;j<100;j++){const h=values[Math.floor(j*values.length/100)]/255*c.height;ctx.fillRect(j*c.width/100,c.height-h,c.width/100-1,h);}
    frames[i]=requestAnimationFrame(render);
   };render();
  }
  context?.resume?.();
 }));
 window.addEventListener('beforeunload',()=>{stopVisuals();context?.close?.();});
})();
