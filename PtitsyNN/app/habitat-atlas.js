'use strict';
/* MoOLVa 5.0 · offline, source-attributed and privacy-coarsened bird atlas. */
(function(){
const root=document.getElementById('habitatAtlas');if(!root)return;
const $=s=>root.querySelector(s);
const birds=Array.isArray(window.BIRDS_DATA)?window.BIRDS_DATA:[];
const byId=new Map(birds.map(b=>[b.id,b]));
const data=window.HABITAT_DATA||{cells:[],bounds:{west:41.60,east:47.96,north:58.19,south:54.35}};
const cells=Array.isArray(data.cells)?data.cells:[];
const bounds=data.bounds||{west:41.60,east:47.96,north:58.19,south:54.35};
const markerLayer=$('#habitatPins'),chooser=$('#habitatSpecies'),search=$('#habitatSearch'),
 summary=$('#habitatSummary'),tooltip=$('#habitatTooltip'),stage=$('#habitatStage'),viewport=$('#habitatViewport'),
 month=$('#habitatMonth'),season=$('#habitatSeason'),stats=$('#habitatStats'),detail=$('#habitatSelection');
const yearRange=e=>e.fromYear===e.toYear?String(e.fromYear):e.fromYear+'–'+e.toYear;
const months=['Все месяцы','Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const fold=s=>String(s||'').toLocaleLowerCase('ru').replace(/ё/g,'е').trim();
let selectedId='all',selectedMonth=0,selectedSeason='all',zoom=1,visible=[];
const seasonMonths={winter:[12,1,2],spring:[3,4,5],summer:[6,7,8],autumn:[9,10,11]};
function species(c){
 const q=fold(search.value);
 return (c.species||[]).filter(s=>{
  const b=byId.get(s.id);if(!b)return false;
  if(selectedId!=='all'&&s.id!==selectedId)return false;
  if(selectedMonth&&!(Array.isArray(s.months)&&s.months.includes(selectedMonth)))return false;
  if(selectedSeason!=='all'&&!(Array.isArray(s.months)&&s.months.some(m=>(seasonMonths[selectedSeason]||[]).includes(m))))return false;
  return !q||fold(b.name+' '+b.latin+' '+(b.group||'')).includes(q);
 });
}
function coords(c){return {left:100*(c.lon-bounds.west)/(bounds.east-bounds.west),top:100*(bounds.north-c.lat)/(bounds.north-bounds.south)};}
function elem(tag,cls,text){
 const x=document.createElement(tag);if(cls)x.className=cls;if(text!=null)x.textContent=String(text);return x;
}
function addOpts(select,options){
 select.replaceChildren(...options.map(([id,label])=>{const e=elem('option',null,label);e.value=String(id);return e;}));
}
function index(){
 const featured=new Set(cells.flatMap(c=>(c.species||[]).map(s=>s.id)));
 addOpts(chooser,[['all','Все виды с наблюдениями'],...birds.slice().sort((a,b)=>a.name.localeCompare(b.name,'ru'))
   .map(b=>[b.id,b.name+(featured.has(b.id)?'':' — нет проверенных зон')])]);
 if(month)addOpts(month,months.map((t,i)=>[i,t]));
}
function hideTooltip(){tooltip.hidden=true;tooltip.replaceChildren();}
function thumbnail(b){
 const image=b?.imageFile;
 if(!image)return elem('span','habitat-no-photo','Нет проверенного фото');
 const x=elem('img','habitat-bird-image');
 x.src=image;x.alt='Фотография '+b.name;x.loading='lazy';return x;
}
function showTooltip(c,origin){
 const speciesList=species(c);
 if(!speciesList.length)return hideTooltip();
 tooltip.replaceChildren();
 const h=elem('strong','habitat-tooltip-heading','Подтверждённые наблюдения · район карты');
 const small=elem('small',null,'Ячейка ~30 км · '+speciesList.length+' видов · не координаты гнёзд');
 tooltip.append(h,small);
 const content=elem('div','habitat-tooltip-list');
 for(const item of speciesList.slice(0,22)){
  const b=byId.get(item.id),row=elem('button','habitat-species-row');
  row.type='button';row.dataset.open=b.id;
  const caption=elem('span','habitat-species-caption');
  caption.append(elem('strong',null,b.name),
    elem('span',null,(b.audioFile?'♪ Голос есть':'♪ Нет записи')+' · '+(b.articleComplete?'Подробная статья':'Краткая справка')),
    elem('small',null,item.n+' сообщений о встречах · '+yearRange(item)+(selectedMonth?' · '+months[selectedMonth] : '')));
  row.append(thumbnail(b),caption);content.appendChild(row);
 }
 if(speciesList.length>22)content.appendChild(elem('small',null,'Показано 22 из '+speciesList.length+' видов'));
 tooltip.appendChild(content);
 const rect=origin.getBoundingClientRect(),container=viewport.getBoundingClientRect();
 const width=Math.min(380,Math.max(250,container.width-12));
 tooltip.style.width=width+'px';
 const maxX=Math.max(6,container.width-width-6);
 tooltip.style.left=Math.min(maxX,Math.max(6,rect.left-container.left+16))+'px';
 const maxY=Math.max(6,container.height-205);
 tooltip.style.top=Math.min(maxY,Math.max(6,rect.top-container.top+20))+'px';
 tooltip.hidden=false;
}
function draw(){
 hideTooltip();
 visible=cells.filter(c=>species(c).length>0);
 markerLayer.replaceChildren();
 for(const c of visible){
  const pos=coords(c);if(!Number.isFinite(pos.left+pos.top)||pos.left<0||pos.left>100||pos.top<0||pos.top>100)continue;
  const list=species(c),btn=elem('button','habitat-pin',String(list.length));
  btn.type='button';btn.style.left=pos.left+'%';btn.style.top=pos.top+'%';
  btn.setAttribute('aria-label','Зона с '+list.length+' видами: '+list.slice(0,3).map(s=>byId.get(s.id).name).join(', '));
  btn.title='Показать виды, опубликованные в этом районе';
  btn.addEventListener('mouseenter',()=>showTooltip(c,btn));
  btn.addEventListener('focus',()=>showTooltip(c,btn));
  btn.addEventListener('click',()=>showTooltip(c,btn));
  markerLayer.appendChild(btn);
 }
 const unique=new Set(visible.flatMap(c=>species(c).map(s=>s.id)));
 const subtitle=selectedId==='all'?'Все виды':(byId.get(selectedId)?.name||'Вид');
 const seasonNames={winter:'Зима',spring:'Весна',summer:'Лето',autumn:'Осень'};
 summary.textContent='Зон: '+visible.length+' · видов: '+unique.size+' · '+subtitle+(selectedMonth?' · '+months[selectedMonth]:'')+(selectedSeason!=='all'?' · '+seasonNames[selectedSeason]:'');
 if(stats){
  stats.replaceChildren();
  for(const [number,title] of [[cells.length,'зон в базе'],[new Set(cells.flatMap(c=>(c.species||[]).map(s=>s.id))).size,'видов с зонами'],[data.matchingRecords||0,'отобранных записей']]){
   const a=elem('div','habitat-stat');a.append(elem('strong',null,number),elem('small',null,title));stats.appendChild(a);
  }
 }
 if(detail){
  detail.replaceChildren();
  if(selectedId==='all')detail.textContent='Выберите птицу, чтобы подсветить районы её опубликованных наблюдений.';
  else{
   const b=byId.get(selectedId);
   if(b){
    detail.append(thumbnail(b),elem('strong',null,b.name));
    detail.append(elem('p',null,visible.length?'Есть укрупнённые зоны исторических наблюдений.':'Для выбранных условий подтверждённых зон в выборке нет. Это не значит, что птица здесь не встречается.'));
    const btn=elem('button','living-button','Открыть паспорт птицы');
    btn.type='button';btn.dataset.open=b.id;detail.appendChild(btn);
   }
  }
 }
 if(!cells.length)summary.textContent='Проверенных зон нет: источник данных не был доступен при сборке. Фиктивные точки не рисуются.';
 else if(selectedMonth&&visible.length===0)summary.textContent+=' · Недостаточно данных по выбранному месяцу, это не означает отсутствия вида.';
}
function zoomTo(value){
 zoom=Math.max(1,Math.min(3,value));stage.style.transform='scale('+zoom+')';
 $('#habitatZoomLevel').textContent=Math.round(zoom*100)+'%';hideTooltip();
}
$('#habitatZoomIn')?.addEventListener('click',()=>zoomTo(zoom+.25));
$('#habitatZoomOut')?.addEventListener('click',()=>zoomTo(zoom-.25));
$('#habitatReset')?.addEventListener('click',()=>zoomTo(1));
viewport.addEventListener('wheel',e=>{if(!e.ctrlKey)return;e.preventDefault();zoomTo(zoom+(e.deltaY<0?.15:-.15));},{passive:false});
chooser.addEventListener('change',()=>{selectedId=chooser.value;draw();});
search.addEventListener('input',draw);
month?.addEventListener('change',()=>{selectedMonth=Number(month.value)||0;if(selectedMonth&&season){season.value='all';selectedSeason='all';}draw();});
season?.addEventListener('change',()=>{selectedSeason=season.value;if(selectedSeason!=='all'&&month){month.value='0';selectedMonth=0;}draw();});
$('#habitatSelectClear')?.addEventListener('click',()=>{
 selectedId='all';selectedMonth=0;selectedSeason='all';chooser.value='all';if(month)month.value='0';if(season)season.value='all';search.value='';zoomTo(1);draw();
});
$('#habitatPopupClose')?.addEventListener('click',hideTooltip);
viewport.addEventListener('keydown',e=>{if(e.key==='Escape')hideTooltip();});
document.addEventListener('click',e=>{if(!e.target.closest('#habitatViewport')&&!e.target.closest('#habitatSpecies'))hideTooltip();});
const source=$('#habitatSource');
if(source)source.textContent=(data.generated?'Дата выборки: '+data.generated+' · ':'')+
 'проверено '+(data.sampledRecords||0)+' записей · принято '+(data.matchingRecords||0)+' · обобщённых зон '+cells.length+'. Источник: GBIF.org, CC-лицензии.';
function focusSpecies(id){
 document.querySelector('nav [data-view="map"]')?.click();
 selectedId=byId.has(id)?id:'all';chooser.value=selectedId;search.value='';
 selectedMonth=0;selectedSeason='all';if(month)month.value='0';if(season)season.value='all';draw();
 root.scrollIntoView({block:'start',behavior:'smooth'});
}
function exportCSV(){
 const header=['Широта центра укрупнённой зоны','Долгота центра укрупнённой зоны','Птица','Научное название','Число записей','С','По','Месяцы с достаточными данными'];
 const rows=[header];
 for(const c of visible)for(const s of species(c)){
  const b=byId.get(s.id);
  rows.push([c.lat,c.lon,b.name,b.latin,s.n,s.fromYear,s.toYear,(s.months||[]).join(',')]);
 }
 const quote=v=>'"'+String(v??'').replace(/\r|\n/g,' ').replace(/^([=+@\-\t])/,"'$1").replace(/"/g,'""')+'"';
 const blob=new Blob(['\ufeff'+rows.map(r=>r.map(quote).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=elem('a');a.href=url;a.download='MoOLVa-5.0-Atlas-Aggregated.csv';
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
$('#habitatExport')?.addEventListener('click',exportCSV);
index();draw();
window.BirdHabitat={focusSpecies,data,coords,exportCSV};
})();