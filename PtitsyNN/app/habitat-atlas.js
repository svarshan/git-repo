'use strict';
/* Offline habitat atlas. Historical open observations aggregated into coarse cells.
   Never renders personal journal coordinates or wildlife nest coordinates.
*/
(function(){
const root=document.getElementById('habitatAtlas');
if(!root)return;
const $=s=>root.querySelector(s);
const birds=Array.isArray(window.BIRDS_DATA)?window.BIRDS_DATA:[];
const byId=new Map(birds.map(b=>[b.id,b]));
const dataset=window.HABITAT_DATA||{cells:[],bounds:{west:41.6,east:47.96,north:58.19,south:54.35},sampledRecords:0};
const cells=Array.isArray(dataset.cells)?dataset.cells:[];
const bounds=dataset.bounds||{west:41.6,east:47.96,north:58.19,south:54.35};
const round=n=>Math.round(n*100)/100;
const markers=$('#habitatPins'),chooser=$('#habitatSpecies'),search=$('#habitatSearch'),summary=$('#habitatSummary'),tooltip=$('#habitatTooltip'),stage=$('#habitatStage'),mapWrap=$('#habitatViewport');
let selectedId='all',zoom=1,visible=[];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function totalCount(){return cells.reduce((n,c)=>n+c.total,0);}
function index(){
 const featured=new Set();
 for(const c of cells)for(const s of c.species||[])if(byId.has(s.id))featured.add(s.id);
 const option=(value,label)=>{const e=document.createElement('option');e.value=value;e.textContent=label;return e;};
 chooser.replaceChildren(option('all','Все птицы с опубликованными наблюдениями'),
 ...[...featured].sort((a,b)=>(byId.get(a)?.name||'').localeCompare(byId.get(b)?.name||'','ru')).map(id=>option(id,byId.get(id).name)));
}
function species(c){return (c.species||[]).filter(s=>byId.has(s.id)&&(selectedId==='all'||s.id===selectedId));}
function coords(c){
 const left=100*(c.lon-bounds.west)/(bounds.east-bounds.west);
 const top=100*(bounds.north-c.lat)/(bounds.north-bounds.south);
 return {left,top};
}
function hideTooltip(){tooltip.hidden=true;}
function showTooltip(c,origin){
 tooltip.replaceChildren();
 const title=document.createElement('strong');title.textContent='Зона возможной встречи · около '+round(c.lat)+'° с.ш., '+round(c.lon)+'° в.д.';
 tooltip.appendChild(title);
 const note=document.createElement('small');note.textContent='Обобщённая ячейка ~30 км, не координаты гнезда и не прогноз';tooltip.appendChild(note);
 const list=document.createElement('div');list.className='habitat-tooltip-list';
 const speciesList=species(c);
 for(const s of speciesList.slice(0,16)){
  const b=byId.get(s.id);
  const btt=document.createElement('button');btt.type='button';btt.dataset.open=s.id;
  btt.textContent=b.name+' · '+s.n+' записей ('+s.fromYear+'–'+s.toYear+')';
  list.appendChild(btt);
 }
 if(speciesList.length>16){const more=document.createElement('span');more.textContent='И ещё '+(speciesList.length-16)+' видов';list.appendChild(more);}
 tooltip.appendChild(list);
 const box=origin.getBoundingClientRect(),holder=mapWrap.getBoundingClientRect();
 const x=Math.max(6,Math.min(holder.width-270,box.left-holder.left+14));
 const y=Math.max(6,Math.min(holder.height-190,box.top-holder.top+12));
 tooltip.style.left=x+'px';tooltip.style.top=y+'px';
 tooltip.hidden=false;
}
function draw(){
 hideTooltip();
 const q=(search.value||'').trim().toLocaleLowerCase('ru').replace(/ё/g,'е');
 const filter=selectedId;
 visible=cells.filter(c=>species(c).length>0&&
  (!q||species(c).some(s=>{const b=byId.get(s.id);return (b.name+' '+b.latin).toLocaleLowerCase('ru').replace(/ё/g,'е').includes(q);})));
 markers.replaceChildren();
 for(const c of visible){
  const pos=coords(c);
  if(pos.left<0||pos.left>100||pos.top<0||pos.top>100)continue;
  const btn=document.createElement('button');
  btn.type='button';btn.className='habitat-pin';btn.style.left=pos.left+'%';btn.style.top=pos.top+'%';
  const listed=species(c),names=listed.slice(0,3).map(s=>byId.get(s.id).name).join(', ');
  btn.setAttribute('aria-label','Зона наблюдений: '+names+', '+listed.length+' видов. Показать сведения.');
  btn.title=listed.length+' видов — '+names;
  btn.textContent=String(listed.length);
  btn.addEventListener('mouseenter',()=>showTooltip(c,btn));
  btn.addEventListener('focus',()=>showTooltip(c,btn));
  btn.addEventListener('click',()=>showTooltip(c,btn));
  markers.appendChild(btn);
 }
 const matchingSpecies=new Set(visible.flatMap(c=>species(c).map(s=>s.id)));
 const title=filter==='all'?'все доступные виды':(byId.get(filter)?.name||'вид');
 summary.textContent='Показаны зоны: '+visible.length+' · видов: '+matchingSpecies.size+' · фильтр: '+title+'. Это обобщённые исторические наблюдения из GBIF, не гарантированные места обитания.';
 if(!cells.length){
  summary.textContent='Проверенные точки пока не удалось загрузить. Карта области работает офлайн; фиктивные наблюдения не создаются. Проверьте источники в разделе «О программе».';
 }
}
function zoomTo(next){
 zoom=Math.max(1,Math.min(2.4,next));stage.style.transform='scale('+zoom+')';
 $('#habitatZoomLevel').textContent=Math.round(zoom*100)+'%';
 hideTooltip();
}
$('#habitatZoomIn')?.addEventListener('click',()=>zoomTo(zoom+0.25));
$('#habitatZoomOut')?.addEventListener('click',()=>zoomTo(zoom-0.25));
$('#habitatReset')?.addEventListener('click',()=>zoomTo(1));
chooser.addEventListener('change',()=>{selectedId=chooser.value;draw();});
search.addEventListener('input',draw);
$('#habitatSelectClear')?.addEventListener('click',()=>{selectedId='all';chooser.value='all';search.value='';draw();});
$('#habitatPopupClose')?.addEventListener('click',hideTooltip);
mapWrap.addEventListener('keydown',e=>{if(e.key==='Escape')hideTooltip();});
document.addEventListener('click',e=>{
 if(!e.target.closest('#habitatViewport')&&!e.target.closest('#habitatSpecies'))hideTooltip();
});
const source=$('#habitatSource');
if(source){
 source.textContent=(dataset.generated?'Выборка обновлена '+dataset.generated+' · ':'')+
  'просмотрено '+(dataset.sampledRecords||0)+' записей · подходящих '+(dataset.matchingRecords||0)+
  ' · зон '+cells.length;
}
function focusSpecies(id){
 document.querySelector('[data-view="map"]')?.click();
 search.value='';
 selectedId=byId.has(id)?id:'all';
 chooser.value=selectedId;
 if(chooser.value!==selectedId){chooser.value='all';selectedId='all';}
 draw();
 document.getElementById('habitatAtlas')?.scrollIntoView({block:'start',behavior:'smooth'});
}
index();draw();
window.BirdHabitat={focusSpecies,data:dataset,coords};
})();
