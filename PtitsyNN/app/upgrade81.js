'use strict';
/* Version 8.1 progressive enhancement. Uses ONLY catalog/GBIF/AI-generated real signals. */
(function(){
 const api=window.MoOLVa81Core,root=document.getElementById('m81Tools'),birds=window.BIRDS_DATA||[];
 if(!api||!root)return;
 const $=s=>document.querySelector(s),byId=new Map(birds.map(b=>[b.id,b]));
 const el=(tag,txt,cls)=>{const n=document.createElement(tag);if(txt!==null&&txt!==undefined)n.textContent=String(txt);if(cls)n.className=cls;return n;};
 const btn=(label,fn)=>{const b=el('button',label,'living-button');b.type='button';b.addEventListener('click',fn);return b;};
 const goto=id=>document.querySelector('aside.sidebar [data-view="'+id+'"]')?.click();
 const passport=id=>document.dispatchEvent(new CustomEvent('living-open',{detail:id}));
 function initCompare(){
  for(const id of ['m81CompareA','m81CompareB']){
   const n=$('#'+id);if(!n)return;
   for(const b of birds){const o=el('option',b.name+' · '+b.latin);o.value=b.id;n.append(o);}
  }
  const first=birds[0],second=birds.find(b=>b.id!==first.id);
  if(first)$('#m81CompareA').value=first.id;
  if(second)$('#m81CompareB').value=second.id;
  function render(){
   const data=api.comparison(byId.get($('#m81CompareA').value),byId.get($('#m81CompareB').value));
   const output=$('#m81Comparison');output.replaceChildren();
   if(!data){output.append(el('p','Выберите два разных вида.','living-note'));return;}
   output.append(el('p',data.type+'; сравнение основано на реальных паспортах, а не сгенерированных отличиях.','living-note'));
   const cols=el('div',null,'m81-duo');
   for(const x of data.rows){
    const card=el('section',null,'m81-card');
    card.append(el('h3',x.name),el('small',x.latin+' · '+x.group));
    if(x.imageFile){const img=el('img');img.src=x.imageFile;img.loading='lazy';img.alt=x.name;card.append(img);}
    if(x.audioFile){const sound=el('audio');sound.src=x.audioFile;sound.controls=true;sound.preload='none';card.append(sound);}
    card.append(el('p',x.excerpt||'Определительные сведения отсутствуют в этом описании.','m81-excerpt'));
    if(x.source){const anchor=el('a','Источник статьи');anchor.href=x.source;anchor.target='_blank';anchor.rel='noopener noreferrer';card.append(anchor);}
    card.append(btn('Открыть паспорт',()=>passport(x.id)));cols.append(card);
   }
   output.append(cols);
  }
  $('#m81CompareA').addEventListener('change',render);$('#m81CompareB').addEventListener('change',render);render();
 }
 let lastVision=null;
 document.addEventListener('moolva-vision-predictions',e=>{
  const obj=e.detail||{};lastVision=obj;const note=$('#m81VisionEvidence');
  note.textContent='Bird Vision: '+(obj.crops||1)+' настоящих проходов ONNX по кадру; классы исходной модели: '+(obj.top?.length||0)+' кандидатов. Это не независимая оценка точности.';
  const choices=(obj.top||[]).map(x=>window.MoOLVa80Core?.regionForLabel(x.label,birds)).filter(Boolean);
  if(choices.length){$('#m81CompareA').value=choices[0].id;const other=choices.find(x=>x.id!==choices[0].id);
   if(other)$('#m81CompareB').value=other.id;
   $('#m81CompareA').dispatchEvent(new Event('change'));
  }
 });
 document.addEventListener('moolva-voice-predictions',e=>{
  const a=api.windows(e.detail||[]),out=$('#m81AudioWindows');out.replaceChildren();
  if(!a.length){out.append(el('p','Модель не вернула временные отметки.','living-note'));return;}
  out.append(el('p','Топ-окна реальной модели (не вероятность присутствия). Фрагменты воспроизводятся в разделе Bird AI.','living-note'));
  for(const item of a.slice(0,12)){
   const x=el('div',null,'m81-line');
   x.append(el('strong',item.offset.toFixed(1)+' с'),el('span',item.label+' · оценка '+item.score.toFixed(2)));
   x.append(btn('Прослушать фрагмент',()=>{goto('birdai');const match=[...document.querySelectorAll('.ai74-timestamp')].find(btn=>btn.textContent.trim()==='▶ '+item.offset.toFixed(1)+' с');match?.click();}));
   out.append(x);
  }
 });
 function reportMap(){
  const species=$('#m81AtlasSpecies')?.value||'all',season=$('#m81AtlasSeason')?.value||'all',min=Number($('#m81AtlasMin')?.value)||0;
  const actual=api.seasonal(window.HABITAT_DATA?.cells||[],species,season,min);
  const years=actual.filter(x=>Number.isFinite(Number(x.toYear))).map(x=>+x.toYear),max=years.length?Math.max(...years):null;
  const observations=actual.reduce((n,x)=>n+x.n,0);
  const p=$('#m81AtlasSummary');
  p.textContent='Укрупнённых записей/зон: '+actual.length+' · наблюдений: '+observations+
   ' · последний документированный год: '+(max||'нет данных')+'. Это не прогноз и не расположение гнёзд.';
  const list=$('#m81AtlasCandidates');list.replaceChildren();
  const byBird=new Map();
  for(const rec of actual){const b=byId.get(rec.id);if(!b)continue;const prior=byBird.get(b.id)||{bird:b,n:0,zones:0};prior.n+=rec.n;prior.zones++;byBird.set(b.id,prior);}
  for(const x of [...byBird.values()].sort((a,b)=>b.n-a.n).slice(0,14)){
   const div=el('div',null,'m81-line');div.append(el('strong',x.bird.name),el('span','Исторических сообщений: '+x.n+' · зон: '+x.zones));
   div.append(btn('На карте',()=>window.BirdHabitat?.focusSpecies(x.bird.id)));list.append(div);
  }
 }
 const mapSpecies=$('#m81AtlasSpecies');if(mapSpecies){const o=el('option','Все виды');o.value='all';mapSpecies.append(o);
  for(const b of birds){const o=el('option',b.name);o.value=b.id;mapSpecies.append(o);}}
 for(const id of ['m81AtlasSpecies','m81AtlasSeason','m81AtlasMin'])$('#'+id)?.addEventListener('change',reportMap);
 reportMap();
 // One screen with large touch/mouse targets, existing options and behaviors retained.
 for(const [id,target] of [['m81QuickPhoto','intelligence80'],['m81QuickSound','birdai'],['m81QuickMap','map'],['m81QuickDiary','journal']]){
  $('#'+id)?.addEventListener('click',()=>{goto(target);if(id==='m81QuickPhoto')$('#m80Photo')?.focus();});
 }
 // Printable local field report, with HTML escaping and no fabricated route geography.
 function journal(){try{const x=JSON.parse(localStorage.getItem('ptitsy-nn.journal.v1')||'[]');return Array.isArray(x)?x:[];}catch{return[];}}
 $('#m81PrintReport')?.addEventListener('click',()=>{
  const a=journal(),options={title:'Экспедиции · Птицы Нижегородской области',start:$('#m81From')?.value||'',end:$('#m81To')?.value||''};
  const stats=api.summarize(a,options);if(!stats.total){$('#m81ReportStatus').textContent='В выбранном периоде не найдено наблюдений.';return;}
  const html=api.printableReport(a,birds,options);
  const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));
  const x=el('a');x.href=url;x.download='MoOLVa-8.1-Expedition-Report.html';document.body.append(x);x.click();x.remove();
  setTimeout(()=>URL.revokeObjectURL(url),4000);
  $('#m81ReportStatus').textContent='Готов печатный отчёт на '+stats.total+' записей и '+stats.places.length+' мест. Для PDF откройте HTML в браузере и выберите Печать → PDF.';
 });
 function performanceReport(){
  const n=$('#m81Performance');if(!n)return;
  const t=performance.getEntriesByType('navigation')?.[0],time=t?Math.round(t.domContentLoadedEventEnd-t.startTime):null;
  const mem=performance.memory?.usedJSHeapSize,metric=Number.isFinite(mem)?' · JS-память ~'+(mem/1048576).toFixed(1)+' МБ':'';
  n.textContent='Измерения на текущем ПК: DOMContentLoaded '+(time==null?'не измерено':time+' мс')+metric+'. Для подтверждения ускорения требуется сравнение с тем же компьютером до обновления.';
 }
 $('#m81PerfRepeat')?.addEventListener('click',performanceReport);performanceReport();
 initCompare();
})();