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
let selectedId='all',selectedMonth=0,selectedSeason='all',zoom=1,visible=[],panX=0,panY=0,lastTownLabelZoom=-1;
const ultra=window.MOOLVA_ULTRA_MAP||null;
const originalTowns=Array.isArray(window.MOOLVA_SETTLEMENTS)?window.MOOLVA_SETTLEMENTS:[];
const osmTowns=Array.isArray(ultra?.places)?ultra.places:[];
const townPoints=[...osmTowns,...originalTowns];
const towns=townPoints.filter((t,i)=>townPoints.findIndex(x=>fold(x.name)===fold(t.name)&&
 Math.abs(x.lat-t.lat)<.06&&Math.abs(x.lon-t.lon)<.09)===i);
const townSearch=$('#habitatTownSearch'),ultraSvg=$('#habitatUltraVector'),ultraStatus=$('#habitatUltraStatus');

const townLayer=$('#habitatTowns'),place=$('#habitatPlace'),placeSummary=$('#habitatPlaceSummary');
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
  btn.type='button';btn.style.left=pos.left+'%';btn.style.top=pos.top+'%';btn.dataset.zone=String(c.lat)+';'+String(c.lon);
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
/* Settlement positions are points of reference, not exact bird locations. */
function distanceKm(a,b){
 const toR=Math.PI/180,dp=(a.lat-b.lat)*toR,dl=(a.lon-b.lon)*toR;
 const q=Math.sin(dp/2)**2+Math.cos(a.lat*toR)*Math.cos(b.lat*toR)*Math.sin(dl/2)**2;
 return 6371*2*Math.atan2(Math.sqrt(q),Math.sqrt(Math.max(0,1-q)));
}
function applyView(){
 const w=viewport.clientWidth,h=viewport.clientHeight;
 panX=Math.max(-w*(zoom-1)/2,Math.min(w*(zoom-1)/2,panX));
 panY=Math.max(-h*(zoom-1)/2,Math.min(h*(zoom-1)/2,panY));
 stage.style.transform='translate3d('+panX+'px,'+panY+'px,0) scale('+zoom+')';
 $('#habitatZoomLevel').textContent=Math.round(zoom*100)+'%';
 if(lastTownLabelZoom!==zoom){
  lastTownLabelZoom=zoom;
  townLayer?.querySelectorAll('.habitat-town').forEach(el=>{
   const tier=Number(el.dataset.tier||3);
   el.hidden=(tier===2&&zoom<1.25)||(tier===3&&zoom<2)||(tier>=4&&zoom<3.05);
  });
 }
 hideTooltip();
}
function zoomTo(value){
 zoom=Math.max(1,Math.min(3.8,value));
 if(zoom===1){panX=0;panY=0;}
 applyView();
}
function focusTown(town){
 if(!town)return;
 zoom=Math.max(zoom,2.1);
 const pos=coords(town),w=viewport.clientWidth,h=viewport.clientHeight;
 panX=(.5-pos.left/100)*w*zoom;
 panY=(.5-pos.top/100)*h*zoom;
 applyView();
 if(place)place.value=town.name;
 if(!placeSummary)return;
 placeSummary.replaceChildren();
 placeSummary.append(elem('strong',null,town.name));
 placeSummary.append(elem('p',null,'Координаты центра населённого пункта приблизительные. Ближайшие обобщённые зоны GBIF — это не подтверждение встреч в самом '+town.name+'.'));
 const near=visible.map(c=>({c,d:distanceKm(town,c)})).filter(x=>Number.isFinite(x.d)&&x.d<=70).sort((a,b)=>a.d-b.d).slice(0,3);
 if(!near.length){placeSummary.append(elem('p',null,'Для выбранных фильтров поблизости нет опубликованных зон. Это не означает отсутствия птиц.'));return;}
 placeSummary.append(elem('p',null,'Ближайшие опубликованные зоны: '+near.length+' (в пределах 70 км от центра).'));
 const ids=new Set();
 for(const {c,d} of near){
  const birdsHere=species(c);
  const count=birdsHere.length;
  const label=elem('button',null,'Зона около '+Math.round(d)+' км · '+count+' видов');
  label.type='button';
  label.addEventListener('click',()=>{
   const btn=[...markerLayer.querySelectorAll('.habitat-pin')].find(b=>b.dataset.zone===String(c.lat)+';'+String(c.lon));
   if(btn)showTooltip(c,btn);
  });
  placeSummary.append(label);
  for(const s of birdsHere)ids.add(s.id);
 }
 placeSummary.append(elem('small',null,'Уникальных видов в этих укрупнённых зонах: '+ids.size+'. Данные исторических наблюдений, не прогноз.'));
}
function updateTownOptions(){
 if(!place)return;
 const q=fold(townSearch?.value);
 const existing=place.value;
 const matches=towns.filter(t=>!q||fold(t.name).includes(q))
   .sort((a,b)=>a.tier-b.tier||a.name.localeCompare(b.name,'ru')).slice(0,160);
 if(existing&&!matches.some(t=>t.name===existing)){
  const selected=towns.find(t=>t.name===existing);if(selected)matches.unshift(selected);
 }
 addOpts(place,[['',q?'Найдено: '+matches.length+' · выберите':'Выберите город или деревню'],...matches.map(t=>[t.name,t.name])]);
 if(existing&&matches.some(t=>t.name===existing))place.value=existing;
}
function drawTowns(){
 if(!townLayer||!place)return;
 townLayer.replaceChildren();
 updateTownOptions();
 for(const town of towns){
  const p=coords(town);
  if(p.left<0||p.left>100||p.top<0||p.top>100)continue;
  const btn=elem('button','habitat-town'+(town.tier===1?' habitat-town--primary':(town.tier>=3?' habitat-town--minor':' habitat-town--secondary')),town.name);
  btn.type='button';btn.style.left=p.left+'%';btn.style.top=p.top+'%';
  btn.title='Населённый пункт '+town.name+' · поиск ближайших зон наблюдений';
  btn.setAttribute('aria-label','Показать на карте '+town.name);
  btn.dataset.tier=String(town.tier);
  btn.hidden=(town.tier===2&&zoom<1.25)||(town.tier===3&&zoom<2)||(town.tier>=4&&zoom<3.05);
  btn.addEventListener('click',e=>{e.stopPropagation();focusTown(town);});
  townLayer.append(btn);
 }
}

townSearch?.addEventListener('input',updateTownOptions);
place?.addEventListener('change',()=>focusTown(towns.find(t=>t.name===place.value)));
$('#habitatShowTowns')?.addEventListener('change',e=>{if(townLayer)townLayer.hidden=!e.target.checked;});
$('#habitatCenter')?.addEventListener('click',()=>{zoom=1;panX=0;panY=0;applyView();});
$('#habitatZoomIn')?.addEventListener('click',()=>zoomTo(zoom+.35));
$('#habitatZoomOut')?.addEventListener('click',()=>zoomTo(zoom-.35));
$('#habitatReset')?.addEventListener('click',()=>zoomTo(1));
viewport.addEventListener('wheel',e=>{e.preventDefault();zoomTo(zoom+(e.deltaY<0?.25:-.25));},{passive:false});
let drag=null;
viewport.addEventListener('pointerdown',e=>{
 if(e.button!==0||e.target.closest('button,.habitat-tooltip'))return;
 drag={id:e.pointerId,x:e.clientX,y:e.clientY,px:panX,py:panY};
 viewport.classList.add('is-dragging');viewport.setPointerCapture(e.pointerId);
});
viewport.addEventListener('pointermove',e=>{
 if(!drag||drag.id!==e.pointerId)return;
 panX=drag.px+e.clientX-drag.x;panY=drag.py+e.clientY-drag.y;applyView();
});
const stopDrag=e=>{
 if(!drag||drag.id!==e.pointerId)return;
 drag=null;viewport.classList.remove('is-dragging');
 if(viewport.hasPointerCapture(e.pointerId))viewport.releasePointerCapture(e.pointerId);
};
viewport.addEventListener('pointerup',stopDrag);
viewport.addEventListener('pointercancel',stopDrag);
chooser.addEventListener('change',()=>{selectedId=chooser.value;draw();});
search.addEventListener('input',draw);
month?.addEventListener('change',()=>{selectedMonth=Number(month.value)||0;if(selectedMonth&&season){season.value='all';selectedSeason='all';}draw();});
season?.addEventListener('change',()=>{selectedSeason=season.value;if(selectedSeason!=='all'&&month){month.value='0';selectedMonth=0;}draw();});
$('#habitatSelectClear')?.addEventListener('click',()=>{
 selectedId='all';selectedMonth=0;selectedSeason='all';if(place)place.value='';if(placeSummary)placeSummary.textContent='Выберите населённый пункт — покажем ближайшие обобщённые зоны наблюдений.';chooser.value='all';if(month)month.value='0';if(season)season.value='all';search.value='';zoomTo(1);draw();
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
/* Detailed OSM geometry is a separate ODbL layer, not invented bird observations.
 * Render combined vector SVG paths for efficient offline zooming; no network calls. */
const SVG='http://www.w3.org/2000/svg';
function vectorPath(coords,close=false){
 if(!Array.isArray(coords)||coords.length<2)return '';
 let out='M'+coords[0][0]+' '+coords[0][1];
 for(let i=1;i<coords.length;i++)out+='L'+coords[i][0]+' '+coords[i][1];
 return out+(close?'Z':'');
}
function addGeometry(layer,features,close,subclass){
 const groups=new Map();
 for(const item of features||[]){
  let tier=1,points=item;
  if(!close){tier=item?.[0]||1;points=item?.[1];}
  const path=vectorPath(points,close);
  if(!path)continue;
  const key=subclass?tier:1;
  groups.set(key,(groups.get(key)||'')+path);
 }
 for(const [tier,d] of groups){
  const path=document.createElementNS(SVG,'path');
  path.classList.add('ultra-shape','ultra-'+layer,'ultra-'+layer+'-'+tier);
  path.dataset.layer=layer;
  path.setAttribute('d',d);
  ultraSvg.appendChild(path);
 }
}
function toggleLayer(layer,checked){
 if(layer==='sightings'){markerLayer.hidden=!checked;return;}
 if(layer==='towns'){townLayer.hidden=!checked;return;}
 for(const node of ultraSvg?.querySelectorAll('[data-layer="'+layer+'"]')||[])node.hidden=!checked;
}
function buildUltraLayers(){
 if(!ultraSvg||!ultra){
  if(ultraStatus)ultraStatus.textContent='Недоступны настоящие офлайн-слои OSM. Подробная карта не готова; контур и точки наблюдений остаются доступными.';
  return;
 }
 const counts=ultra.selectedCounts||{};
 const ok=['road','river','lake','forest','place'].every(k=>(counts[k]||0)>=50);
 if(!ok){
  if(ultraStatus)ultraStatus.textContent='Пакет OSM неполон: не отображаю вымышленные дороги и леса.';
  return;
 }
 // Paint order: woods below water, river lines above, roads on top.
 addGeometry('forests',ultra.forests,true,false);
 addGeometry('lakes',ultra.lakes,true,false);
 addGeometry('rivers',ultra.rivers,false,true);
 addGeometry('roads',ultra.roads,false,true);
 if(ultraStatus)ultraStatus.textContent='Офлайн OSM · '+counts.road+' дорог · '+counts.river+' речных участков · '+counts.lake+' водоёмов · '+
  counts.forest+' лесных контуров · '+counts.place+' населённых пунктов. © OpenStreetMap contributors, ODbL 1.0. Данные не для навигации.';
 const layers={Roads:'roads',Rivers:'rivers',Lakes:'lakes',Forests:'forests',ShowTowns:'towns',ShowSightings:'sightings'};
 for(const [id,layer] of Object.entries(layers)){
  const control=$('#habitatLayer'+id)||$('#habitat'+id);
  if(!control)continue;
  control.addEventListener('change',()=>toggleLayer(layer,control.checked));
  toggleLayer(layer,control.checked);
 }
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
index();draw();drawTowns();buildUltraLayers();applyView();
window.BirdHabitat={focusSpecies,focusTown,data,coords,exportCSV,towns,ultra,buildUltraLayers};
})();