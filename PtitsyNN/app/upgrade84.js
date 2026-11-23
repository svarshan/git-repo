'use strict';
/* Progressive 8.4 features; no cloud, synthesized calls, or invented bird identity. */
(function(){
 const core=window.MoOLVa84Core,root=document.getElementById('m84Tools');
 if(!core||!root)return;
 const birds=Array.isArray(window.BIRDS_DATA)?window.BIRDS_DATA:[];
 const $=id=>document.getElementById(id),element=(tag,text,cls)=>{
  const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;
 };
 const button=(name,fn)=>{const b=element('button',name);b.type='button';b.addEventListener('click',fn);return b;};
 const navigate=(id)=>document.querySelector('aside.sidebar [data-view="'+id+'"]')?.click();
 const count=core.integrity(birds);
 $('m84Goal').textContent='Реальные голоса: '+count.available+' / 298 · ещё '+count.missing.length+
  ' · фотографии '+count.photos+'/298 · статьи '+count.articles+'/298. Цель: 298 подлинных лицензированных записей; недостающие не подменяются.';
 const miss=$('m84Missing');miss.replaceChildren();
 for(const b of count.missing.slice(0,50)){
  const line=element('div',(b.name||b.latin)+' · '+b.latin,'m84-line');miss.append(line);
 }
 $('m84MissingCount').textContent='Пока нет подтверждённых записей для '+count.missing.length+' видов.';
 $('m84Search').addEventListener('input',()=>{
  const rows=core.findByTraits(birds,$('m84Search').value,$('m84OnlyVoiced').checked);
  const target=$('m84Results');target.replaceChildren();
  for(const entry of rows){
   const card=element('article',null,'m84-item'),heading=element('strong',entry.bird.name);
   card.append(heading,element('small',' · '+entry.bird.latin));
   if(entry.bird.imageFile){const image=element('img');image.src=entry.bird.imageFile;image.alt=entry.bird.name;image.loading='lazy';card.append(image);}
   card.append(element('p',(entry.bird.description||'Нет опубликованного описания.').slice(0,230)));
   card.append(button('Паспорт вида',()=>document.dispatchEvent(new CustomEvent('living-open',{detail:entry.bird.id}))));
   if(entry.bird.audioFile){const audio=element('audio');audio.src=entry.bird.audioFile;audio.preload='none';audio.controls=true;card.append(audio);}
   target.append(card);
  }
  if(!rows.length&&$('m84Search').value.trim())target.append(element('p','По опубликованным описаниям совпадений нет.','m83-muted'));
 });
 $('m84OnlyVoiced').addEventListener('change',()=> $('m84Search').dispatchEvent(new Event('input')));
 $('m84Year').addEventListener('change',()=>{
  const year=Number($('m84Year').value)||null;
  const rows=core.historicalEvidence(window.HABITAT_DATA?.cells||[],null,year);
  const species=new Set(rows.map(x=>x.speciesId));
  $('m84YearResult').textContent=year?'За '+year+' год есть опубликованные данные у '+species.size+' видов в '+rows.length+' укрупнённых зонах. Исторические записи не являются прогнозом на сегодня.':'Выберите год, чтобы отфильтровать опубликованные исторические записи.';
 });
 const renderPredictions=(kind,predictions)=>{
  const ev=core.modelEvidence(predictions),target=$('m84AIResult');target.replaceChildren();
  target.append(element('p',(kind==='voice'?'Голос':'Фото')+': '+ev.message+' Относительные оценки, не вероятности.','m83-muted'));
  for(const item of ev.top){
   const latin=String(item.label||item.latin||'').toLowerCase();
   const bird=birds.find(b=>b.latin?.toLowerCase()===latin);
   const row=element('div',null,'m84-candidate');
   row.append(element('span',(bird?.name||item.label||'Неизвестный класс')+' · оценка '+Number(item.score).toFixed(2)));
   if(bird)row.append(button('Открыть паспорт',()=>document.dispatchEvent(new CustomEvent('living-open',{detail:bird.id}))));
   target.append(row);
  }
 };
 document.addEventListener('moolva-voice-predictions',e=>renderPredictions('voice',e.detail));
 document.addEventListener('moolva-vision-predictions',e=>renderPredictions('photo',e.detail?.top));
 $('m84Sound').addEventListener('click',()=>navigate('birdai'));
 $('m84Photo').addEventListener('click',()=>navigate('intelligence80'));
 $('m84Journal').addEventListener('click',()=>{navigate('journal');$('newObservation')?.click();});
 $('m84Map').addEventListener('click',()=>navigate('map'));
 $('m84Media').addEventListener('click',()=>navigate('media83'));
 $('m84CheckBackup').addEventListener('click',()=>{navigate('media83');$('m83CheckBackups')?.click();});
})();
