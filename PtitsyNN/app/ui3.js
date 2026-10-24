'use strict';
/* MoOLVa 3.0: offline dashboard additions. Existing 2.x user data keys stay intact. */
(function(){
const $=s=>document.querySelector(s);
const birds=Array.isArray(window.BIRDS_DATA)?window.BIRDS_DATA:[];
const byId=new Map(birds.map(b=>[b.id,b]));
const icons={
home:'<path d="m3 10 9-7 9 7"/><path d="M5 9v12h14V9M9 21v-8h6v8"/>',
bird:'<path d="M20 7a6 6 0 0 0-8 2l-2.3 3.5a7 7 0 0 1-6 3.5H2"/><path d="m15 6 3-3 4 2-2 2M9 17l-3 4m7-4 1 4M4 16c0-4 4-7 8-7"/>',
search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
map:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15m6-12v15"/>',
pin:'<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6m10-6v6M3 10h18m-13 4h2m4 0h2"/>',
journal:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 3v18m4-13h5m-5 4h5m-5 4h3"/>',
star:'<path d="m12 2 3.2 6.6 7.2 1-5.2 5 .9 7.4L12 18.5l-6.1 3.5.9-7.4-5.2-5 7.2-1Z"/>',
clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
compare:'<path d="M2 8h20M6 8l-4 8h8L6 8Zm12 0-4 8h8l-4-8ZM12 4v17m-5 0h10"/>',
image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 3-3 6 5"/>',
wave:'<path d="M2 11v2m4-7v12m4-15v18m4-11v4m4-8v12m4-7v2"/>',
book:'<path d="M12 6c-3-3-6-3-10-2v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-4-1-7-1-10 2ZM12 6v15"/>',
settings:'<circle cx="12" cy="12" r="3"/><path d="M10 2h4l.6 2.3 2 1.1 2.2-1 2.8 2.8-1 2.2 1.1 2 .3 2.6-2.3.5-1.1 2 1 2.2-2.8 2.8-2.2-1-2 1.1L14 22h-4l-.6-2.3-2-1.1-2.2 1-2.8-2.8 1-2.2-1.1-2L2 10l2.3-.5 1.1-2-1-2.2 2.8-2.8 2.2 1 2-1.1Z" transform="rotate(15 12 12)"/>',
info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
check:'<path d="m4 12 5 5L20 6"/>'
};
const svg=name=>'<svg class="ui3-icon" aria-hidden="true" viewBox="0 0 24 24">'+(icons[name]||icons.bird)+'</svg>';
for(const item of document.querySelectorAll('[data-icon]'))item.innerHTML=svg(item.dataset.icon);
function readJournal(){
 try{const items=JSON.parse(localStorage.getItem('ptitsy-nn.journal.v1')||'[]');return Array.isArray(items)?items:[];}
 catch{return [];}
}
function readSettings(){
 try{return JSON.parse(localStorage.getItem('ptitsy-nn.ui3.settings.v1')||'{}')||{};}
 catch{return {};}
}
function applySettings(s){
 document.body.classList.toggle('ui3-brighter',!!s.bright);
 document.body.classList.toggle('ui3-compact',!!s.compact);
 document.body.classList.toggle('ui3-no-motion',!!s.reduceMotion);
 for(const [id,key] of [['ui3-bright','bright'],['ui3-compact','compact'],['ui3-motion','reduceMotion']]){
  const control=$('#'+id);if(control)control.checked=!!s[key];
 }
}
applySettings(readSettings());
for(const [id,key] of [['ui3-bright','bright'],['ui3-compact','compact'],['ui3-motion','reduceMotion']]){
 const control=$('#'+id);
 control?.addEventListener('change',()=>{
  const next={...readSettings(),[key]:control.checked};
  try{localStorage.setItem('ptitsy-nn.ui3.settings.v1',JSON.stringify(next));}catch{}
  applySettings(next);
 });
}
function renderMetrics(){
 const all=birds.length;
 const values=[
  ['countAll',all],['countAudio',birds.filter(b=>b.audioFile).length],
  ['countImages',birds.filter(b=>b.imageFile).length],
  ['countArticles',birds.filter(b=>b.articleComplete).length]
 ];
 for(const [id,n] of values){
  const el=$('#'+id);if(el)el.textContent=String(n);
  const bar=$('[data-bar="'+id+'"]');if(bar)bar.style.setProperty('--pct',Math.round(n/Math.max(1,all)*100)+'%');
 }
}
function getNamedBird(terms,used){
 for(const term of terms){const b=birds.find(x=>x.imageFile&&x.name.toLowerCase().includes(term)&&!used.has(x.id));if(b){used.add(b.id);return b;}}
 const fallback=birds.find(x=>x.imageFile&&!used.has(x.id));if(fallback){used.add(fallback.id);return fallback;}
 return null;
}
function setImage(container,b){
 if(!container)return;
 container.replaceChildren();
 if(b&&b.imageFile){
  const img=document.createElement('img');img.src=b.imageFile;img.alt='Фотография: '+b.name;img.loading='lazy';
  container.appendChild(img);
 }else{
  const msg=document.createElement('span');msg.className='ui3-missing';msg.textContent='Фотография отсутствует';container.appendChild(msg);
 }
}
function renderFeatures(){
 const used=new Set();
 const featured=[
  ['ui3-cover-catalog',['синиц','поползень','сойк']],
  ['ui3-cover-field',['журавл','цапл','лебед']],
  ['ui3-cover-audio',['солове','зарянк','певчи','пеночк']]
 ];
 for(const [id,terms] of featured)setImage($('#'+id),getNamedBird(terms,used));
 const logo=getNamedBird(['зимород','синиц'],new Set());
 setImage($('#ui3-logo'),logo);
}
function makeMini(b){
 const button=document.createElement('button');button.type='button';button.className='ui3-mini';button.dataset.open=b.id;
 if(b.imageFile){const img=document.createElement('img');img.src=b.imageFile;img.loading='lazy';img.alt=b.name;button.appendChild(img);}
 else{const d=document.createElement('span');d.className='ui3-missing';d.textContent='Нет фото';button.appendChild(d);}
 const t=document.createElement('strong');t.textContent=b.name;button.appendChild(t);return button;
}
function renderPreview(){
 const good=birds.filter(b=>b.imageFile);
 const terms=['серая ворона','большая синица','снегир','полевой воробей','сойка','дятел'];
 const used=new Set(),featured=[];
 for(const term of terms){const b=good.find(x=>x.name.toLowerCase().includes(term)&&!used.has(x.id));if(b){used.add(b.id);featured.push(b);}}
 if(!featured.length)featured.push(...good.slice(0,6));
 const row=$('#ui3-season-list');if(row)row.replaceChildren(...featured.map(makeMini));
 const recent=$('#ui3-photo-list');if(recent)recent.replaceChildren(...good.slice(0,8).map(makeMini));
}
function renderGallery(){
 const el=$('#ui3-gallery');if(!el)return;
 const query=($('#ui3-gallery-search')?.value||'').toLocaleLowerCase('ru').replace(/ё/g,'е').trim();
 const matched=birds.filter(b=>b.imageFile&&(!query||(b.name+' '+b.latin).toLocaleLowerCase('ru').replace(/ё/g,'е').includes(query)));
 const count=$('#ui3-gallery-count');if(count)count.textContent='Фотографий с подтверждённой лицензией: '+matched.length;
 el.innerHTML=matched.slice(0,120).map(b=>'<article class="bird"><button class="photo" data-open="'+escapeHtml(b.id)+'"><img loading="lazy" src="'+escapeHtml(b.imageFile)+'" alt="'+escapeHtml(b.name)+'"></button><div class="meta"><h3>'+escapeHtml(b.name)+'</h3><div class="latin">'+escapeHtml(b.latin)+'</div></div></article>').join('')||'<p>По запросу фотографий не найдено.</p>';
}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
$('#ui3-gallery-search')?.addEventListener('input',renderGallery);
function renderMap(){
 const el=$('#ui3-places');if(!el)return;
 const places=new Map();
 for(const o of readJournal()){
  const name=String(o.place||'').trim();if(!name)continue;
  const k=name.toLocaleLowerCase('ru');const p=places.get(k)||{name,count:0,types:new Set()};
  p.count++;if(byId.has(o.birdId))p.types.add(o.birdId);places.set(k,p);
 }
 const list=[...places.values()].sort((a,b)=>b.count-a.count).slice(0,40);
 el.replaceChildren();
 if(!list.length){const p=document.createElement('p');p.textContent='Сохранённых мест пока нет. Добавьте встречу в дневник — здесь появится её место.';el.appendChild(p);return;}
 for(const p of list){
  const card=document.createElement('article');card.className='ui3-info-card';
  const h=document.createElement('strong');h.textContent=p.name;
  const meta=document.createElement('p');meta.textContent=p.count+' встреч · '+p.types.size+' видов';
  card.append(h,meta);el.appendChild(card);
 }
}
function renderCalendar(){
 const el=$('#ui3-calendar-grid');if(!el)return;
 const names=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
 const list=readJournal();
 el.replaceChildren(...names.map((month,i)=>{
  const matches=list.filter(j=>/^\d{4}-(\d{2})/.test(j.date||'')&&Number(j.date.slice(5,7))===i+1);
  const el=document.createElement('article');el.className='ui3-info-card';
  const h=document.createElement('strong');h.textContent=month;
  const p=document.createElement('p');p.textContent=matches.length+' наблюдений · '+new Set(matches.map(x=>x.birdId)).size+' видов';
  el.append(h,p);return el;
 }));
}
function refreshViews(){
 renderMap();renderCalendar();renderGallery();
}
renderMetrics();renderFeatures();renderPreview();refreshViews();
document.querySelectorAll('[data-jump]').forEach(b=>b.addEventListener('click',e=>{
 e.preventDefault();e.stopPropagation();
 const home=document.querySelector('nav button[data-view="'+(b.dataset.page||'catalog')+'"]');
 if(home)home.click();
 requestAnimationFrame(()=>document.getElementById(b.dataset.jump)?.scrollIntoView({block:'start',behavior:document.body.classList.contains('ui3-no-motion')?'auto':'smooth'}));
},true));
$('#ui3-top-search')?.addEventListener('input',e=>{
 const original=$('#search');if(!original)return;
 original.value=e.target.value;
 original.dispatchEvent(new Event('input',{bubbles:true}));
});
$('#ui3-top-search')?.addEventListener('keydown',e=>{
 if(e.key==='Enter'){
  e.preventDefault();
  document.querySelector('nav button[data-view="catalog"]')?.click();
  document.getElementById('catalogList')?.scrollIntoView({block:'start',behavior:'smooth'});
 }
});
document.addEventListener('click',e=>{
 if(e.target.closest('[data-view]'))queueMicrotask(refreshViews);
 if(e.target.closest('#newObservation,[data-edit],[data-remove]'))queueMicrotask(refreshViews);
});
})();
