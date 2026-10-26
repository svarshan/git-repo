'use strict';
/* MoOLVa 7.6: local expedition summaries, no precise location inference or sync. */
(function(){
 const stats=document.getElementById('m76ExpeditionStats'),recent=document.getElementById('m76ExpeditionRecent');
 if(!stats||!recent)return;
 const birds=new Map((window.BIRDS_DATA||[]).map(b=>[b.id,b]));
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=String(text);if(cls)n.className=cls;return n;};
 function update(){
  let data=[];try{const a=JSON.parse(localStorage.getItem('ptitsy-nn.journal.v1')||'[]');if(Array.isArray(a))data=a;}catch{}
  const items=data.filter(x=>x&&birds.has(x.birdId)&&typeof x.place==='string'&&typeof x.date==='string');
  const unique=new Set(items.map(x=>x.birdId)),places=new Set(items.map(x=>x.place.trim()).filter(Boolean));
  stats.replaceChildren();
  for(const [num,label] of [[items.length,'сохранённых встреч'],[unique.size,'наблюдавшихся видов'],[places.size,'записанных мест']]){
   const card=el('article',null,'ui3-info-card');card.append(el('strong',num),el('p',label));stats.append(card);
  }
  recent.replaceChildren();
  const title=el('h3','Последние записи из моего дневника');recent.append(title);
  const sorted=[...items].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,25);
  if(!sorted.length){recent.append(el('p','Наблюдений пока нет. Добавьте первую встречу в дневнике.','living-note'));return;}
  for(const x of sorted){
   const card=el('article',null,'ui3-info-card'),name=birds.get(x.birdId)?.name||'Неизвестный вид';
   card.append(el('strong',name),el('p',x.date.replace('T',' ')+' · '+x.place+' · '+(Number(x.count)||1)+' шт.'));
   if(x.notes)card.append(el('small',String(x.notes).slice(0,300)));
   recent.append(card);
  }
 }
 document.addEventListener('click',e=>{if(e.target.closest?.('[data-view="expedition"]'))queueMicrotask(update);});
 window.addEventListener('moolva75-journal-changed',update);
 update();
})();
