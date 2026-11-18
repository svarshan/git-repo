/* Офлайн-карта Protomaps и дополнительная онлайн-подложка OpenStreetMap. */
'use strict';
(function(root, factory) {
  const api=factory();
  if(typeof module==='object' && module.exports) module.exports=api;
  if(root) { root.MoOLVaFreeMap32Core=api;
    if(root.document)root.addEventListener('DOMContentLoaded',()=>api.mount(root)); }
})(typeof window!=='undefined'?window:null,function() {
 const bounds={minLat:54.1,maxLat:58.2,minLon:41.2,maxLon:48.2};
 const palette={report:'#f7aa53',observations:'#8bdb9c',personal:'#70c9f7','public-exact':'#ca9afa'};
 const legal='© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>';
 const mapArchive='moolva-map://offline/nizhny-novgorod.pmtiles';
 const offlineExtent=[[54.38,41.55],[58.22,47.85]];
 const normalizeName=text=>text.trim().toLocaleLowerCase('ru').replaceAll('ё','е');
 function valid(lat,lon) {
  const a=Number(lat),b=Number(lon);
  return Number.isFinite(a)&&Number.isFinite(b) && a>=bounds.minLat&&a<=bounds.maxLat&&b>=bounds.minLon&&b<=bounds.maxLon;
 }
 function centerOf(points) {
  const validPoints=points.filter(x=>valid(x?.lat,x?.lon));
  if(!validPoints.length)return {lat:56.35,lon:43.5};
  const sum=validPoints.reduce((acc,x)=>({lat:acc.lat+Number(x.lat),lon:acc.lon+Number(x.lon)}),{lat:0,lon:0});
  return {lat:sum.lat/validPoints.length,lon:sum.lon/validPoints.length};
 }
 function present(p) {
   if(p.kind==='report')return p.name+' — только окрестности населённого пункта (≈'+p.approxKm+' км)';
   if(p.kind==='personal')return 'Личное место: '+p.name;
   if(p.kind==='public-exact')return p.latin+' — GPS-наблюдение '+p.date+', ±'+p.accuracyM+' м';
   return 'Обобщённые наблюдения: '+p.count+' шт. (ячейка порядка 10–20 км)';
 }
 function collection(exp,personal,exact,filters) {
  const out=[];
  if(filters.report)for(const x of exp.reportData||[])if(valid(x.lat,x.lon))out.push({...x,kind:'report'});
  if(filters.observations)for(const x of exp.observationCells||[])if(valid(x.lat,x.lon))out.push({...x,kind:'observations'});
  if(filters.personal)for(const x of personal||[])if(valid(x.lat,x.lon))out.push({...x,kind:'personal'});
  if(filters.exact)for(const x of exact||[])if(valid(x.lat,x.lon))out.push({...x,kind:'public-exact'});
  return out;
 }
 function mount(w) {
  const d=w.document, box=d.getElementById('exp-map'), section=d.getElementById('expedition30');
  if(!box||!section||d.getElementById('fm32-map'))return;
  // Даже если необязательная «Экспедиция» не инициализируется, базовая карта остаётся доступна.
  const fallbackExp={
    reportData:Array.isArray(w.MOOLVA_COMMUNITY30)?w.MOOLVA_COMMUNITY30:[],
    observationCells:w.MoOLVaExpeditionCore30?.aggregate?.(w.MOOLVA_REGION_OBS20||[])||[],
    show:()=>{
      d.querySelectorAll('section.page').forEach(x=>x.classList.toggle('active',x===section));
      d.querySelectorAll('.sidebar button').forEach(x=>x.classList.toggle('selected',x.id==='primary-map-nav'));
      if(d.getElementById('heading'))d.getElementById('heading').textContent='Карта грибных мест';
      if(d.getElementById('subtitle'))d.getElementById('subtitle').textContent='Бесплатная карта с населёнными пунктами';
      w.dispatchEvent(new w.CustomEvent('moolva:expedition-shown'));
    }
  };
  const exp=w.MoOLVaExpedition30||fallbackExp;
  if(!w.MoOLVaExpedition30)d.addEventListener('click',e=>{
    if(e.target.closest('[data-expedition30="open"]')){e.preventDefault();fallbackExp.show();}
  },true);
  const L=w.L;
  const $=id=>d.getElementById(id);
  // Скрываем устаревший переключатель фоновой координатной схемы, если Leaflet установлен.
  if(L&&$('exp-online'))$('exp-online').hidden=true;
  // Главный вход в карту теперь находится сверху, а старая схема отдельно обозначена как архив.
  const nav=d.querySelector('.sidebar nav'),expEntry=nav?.querySelector('[data-expedition30="open"]');
  if(nav&&expEntry){nav.insertBefore(expEntry,nav.children[1]||null);expEntry.innerHTML='<span>🗺</span> Карта грибных мест';}
  const oldMapEntry=nav?.querySelector('[data-stage20="geo20"]');
  if(oldMapEntry)oldMapEntry.innerHTML='<span>⌖</span> Схема наблюдений';
  for(const btn of d.querySelectorAll('[data-goto20="geo20"]'))btn.textContent='🗺 Карта грибных мест';
  // Даже старые кнопки «Карта» ведут в работающую Экспедицию, не к координатной сетке.
  d.addEventListener('click',e=>{
    const link=e.target.closest('[data-goto20="geo20"]');
    if(!link)return;
    e.preventDefault();e.stopImmediatePropagation();
    exp.show();
  },true);
  const bar=d.createElement('section');bar.id='fm32-toolbar';bar.className='fm32-toolbar';
  bar.innerHTML='<div class="fm32-header"><strong>🗺 Карта Нижегородской области</strong><small id="fm32-source">Офлайн · карта встроена</small></div>'+
   '<p class="fm32-help">Колёсико мыши — масштаб; удерживайте мышь и перемещайте карту; кнопки + и − — увеличение. Нажмите на свободное место карты, чтобы заполнить координаты своей отметки.</p>'+
   '<div class="fm32-tools"><input id="fm32-town" type="search" aria-label="Населённый пункт" placeholder="Населённый пункт: Бор, Балахна, Фролищи…" autocomplete="off">'+
   '<button type="button" id="fm32-find" class="exp-button">⌕ Найти</button><button type="button" id="fm32-reset" class="exp-button">⌖ Вся область</button>'+
   '<button type="button" id="fm32-last" class="exp-button">Последнее место</button>'+
   '<button type="button" id="fm32-switch" class="exp-button">Перейти к онлайн-карте</button>'+
   '<button type="button" id="fm32-open-external" class="exp-button">↗ Открыть OpenStreetMap</button></div>'+
   '<div id="fm32-results" class="fm32-results" hidden></div>'+
   '<div id="fm34-packs" class="fm32-tools fm34-row" hidden><label for="fm34-pack">Подробная карта</label><select id="fm34-pack"></select><button type="button" class="exp-button" id="fm34-download">Открыть участок</button><small id="fm34-pack-status" role="status"></small></div>'+
   '<div class="fm32-tools fm34-row"><label for="fm34-species">Находки</label><input type="search" id="fm34-species" placeholder="Русское или латинское название" autocomplete="off">'+
   '<select id="fm34-age" aria-label="Период"><option value="">За всё время</option><option value="7">За 7 дней</option><option value="30">За 30 дней</option><option value="90">За 90 дней</option><option value="year">За этот год</option></select></div>'+
   '<p role="status" id="fm32-status" class="fm32-status">Открывается встроенная карта…</p>';
  section.querySelector('.exp-map-shell').before(bar);
  const surface=d.createElement('div');surface.id='fm32-map';surface.className='fm32-map';surface.hidden=true;
  box.append(surface);
  const towns=(exp.reportData||[]).filter(x=>valid(x.lat,x.lon));
  const localities=(w.MOOLVA_OFFLINE_LOCALITIES||[]).map(([name,lat,lon,kind])=>({name,lat,lon,kind,query:normalizeName(name)}));
  const searchable=localities.length?localities:towns.map(p=>({...p,query:normalizeName(p.name)}));
  const majorTowns=localities.filter(place=>['city','town'].includes(place.kind));
  const species=(w.MOOLVA_MUSHROOMS||[]).map(x=>[normalizeName(x.name),normalizeName(x.latin)]);
  // Программа сохраняет те же локальные ключи, что и версии 3.0 и 3.1.
  function privatePoints(){try{const v=JSON.parse(w.localStorage.getItem('moolva-griby-v3-private-points')||'[]');return Array.isArray(v)?v.filter(x=>x&&valid(x.lat,x.lon)).slice(-600):[];}catch{return [];}}
  function privateTrack(){try{const v=JSON.parse(w.localStorage.getItem('moolva-griby-v3-private-track')||'[]');return Array.isArray(v)?v.filter(x=>x&&valid(x.lat,x.lon)).slice(-5000):[];}catch{return [];}}
  function layerFilters(){return {report:!!$('exp-reports')?.checked,observations:!!$('exp-observations')?.checked,personal:!!$('exp-personal')?.checked,
     exact:!!$('gm31-exact-checkbox')?.checked};}
  function allPoints(){
    const q=normalizeName($('fm34-species').value);
    const names=q?species.filter(x=>x.some(name=>name.includes(q))).map(x=>x[1]):[];
    const period=$('fm34-age').value;
    const today=new Date();
    const since=period==='year'?`${today.getFullYear()}-01-01`:period?new Date(today.getTime()-(Number(period)-1)*86400000).toISOString().slice(0,10):'';
    const inPeriod=date=>!since||date>=since;
    const reports=(exp.reportData||[]).filter(x=>inPeriod(x.reported)&&(!q||normalizeName(x.species).includes(q)));
    const rows=(w.MOOLVA_REGION_OBS20||[]).filter(x=>!x.obscured&&inPeriod(x.date)&&(!q||normalizeName(x.latin||'').includes(q)||names.includes(normalizeName(x.latin||''))));
    const observationCells=w.MoOLVaExpeditionCore30?.aggregate?.(rows) || [];
    const exact=w.MoOLVaGoogle31Core?.exactPublicObservations?.(rows) || [];
    return collection({reportData:reports,observationCells},privatePoints(),exact,layerFilters());
  }
  function status(text){$('fm32-status').textContent=text;}
  let map=null,tiles=null,markers=null,circles=null,trackLayer=null,searchMarker=null;
  let loadedTiles=0,failedTiles=0,googleActive=false,online=!w.protomapsL;
  let activePack=null, packs=[];
  function getLastPlace(){try{return JSON.parse(w.localStorage.getItem('moolva-griby-last-place')||'null');}catch{return null;}}
  $('fm32-last').disabled=!getLastPlace();
  function removeLayers() {
   if(!map)return;
   if(markers)markers.clearLayers();
   if(circles)circles.clearLayers();
   if(trackLayer)trackLayer.clearLayers();
  }
  function redraw() {
   if(!map)return;
   removeLayers();
   const points=allPoints();
   for(const p of points) {
    const color=palette[p.kind]||'#dddddd';
    const marker=L.circleMarker([p.lat,p.lon],{radius:p.kind==='personal'?10:p.kind==='public-exact'?9:p.kind==='report'?8:6,
      color:'#1b2a21',weight:2,fillColor:color,fillOpacity:.97,keyboard:true,interactive:true});
    const safeTooltip=d.createElement('span');safeTooltip.textContent=present(p);
    marker.bindTooltip(safeTooltip,{direction:'top',opacity:.96});
    marker.on('click',()=>{
      if(p.kind!=='public-exact'&&typeof exp.selectPoint==='function')exp.selectPoint(p);
      else if(w.MoOLVaGoogle31?.choose)w.MoOLVaGoogle31.choose(p);
      marker.openTooltip();
      if(p.kind==='public-exact')status(present(p)+' — откройте источник iNaturalist в карточке.');
    });
    markers.addLayer(marker);
    if(p.kind==='report') {
      // Окружность отражает приблизительный РАДИУС ПОИСКА, а не точное место находки.
      circles.addLayer(L.circle([p.lat,p.lon],{radius:p.approxKm*1000,color:'#e39b54',weight:1,
         fillColor:'#e39b54',fillOpacity:.055,interactive:false}));
    }
   }
   const route=exp.getDisplayTrack?.()||privateTrack();
   if(route.length>1)trackLayer.addLayer(L.polyline(route.map(p=>[p.lat,p.lon]),{color:'#70c9f7',weight:3}));
   status('Отметок на карте: '+points.length+'. Оранжевые круги показывают окрестности находок.');
  }
  function setBasemap() {
   if(tiles)tiles.remove();
   loadedTiles=0;failedTiles=0;
   $('fm32-source').textContent=online?'Онлайн · OpenStreetMap':activePack?`Офлайн · ${activePack.name}`:'Офлайн · подробная карта области';
   $('fm32-switch').textContent=online?'Перейти к офлайн-карте':'Перейти к онлайн-карте';
   $('fm32-switch').disabled=!w.protomapsL;
   const options={minZoom:6,maxZoom:19,keepBuffer:2,updateWhenIdle:true,noWrap:true};
   if(online){
    map.setMaxBounds(null);
    tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{...options,attribution:legal});
   }else{
    const bounds=activePack?[[activePack.bounds[1],activePack.bounds[0]],[activePack.bounds[3],activePack.bounds[2]]]:offlineExtent;
    map.setMaxBounds(bounds);
    const url=w.location.protocol==='file:'?mapArchive:new URL('maps/nizhny-novgorod.pmtiles',w.location.href).href;
    tiles=w.protomapsL.leafletLayer({...options,bounds,url,flavor:'light',lang:'ru',maxDataZoom:14,
     attribution:legal+' · <a href="https://protomaps.com/" target="_blank" rel="noopener noreferrer">Protomaps</a>'});
   }
   tiles.on('tileload',()=>{loadedTiles++;});
   tiles.on('tileerror',()=>{
    failedTiles++;
    if(online&&failedTiles>=3&&loadedTiles===0)status('Онлайн-карта недоступна. Можно переключиться на встроенную офлайн-карту.');
   });
   tiles.addTo(map);
  }
  const packSelect=$('fm34-pack'), packButton=$('fm34-download');
  function refreshPackControls(){
   const item=packs.find(p=>p.id===packSelect.value);
   if(!item)return;
   $('fm34-pack-status').textContent='Все шесть участков встроены';
  }
  async function loadPacks(){
   if(!w.MoOLVaMaps)return;
   try{
    packs=await w.MoOLVaMaps.list()||[];
    if(!packSelect.options.length){
     for(const item of packs){const option=d.createElement('option');option.value=item.id;option.textContent=item.name;packSelect.append(option);}
     packSelect.value='center';
    }
    $('fm34-packs').hidden=!packs.length;
    refreshPackControls();
   }catch{status('Список загруженных карт недоступен.');}
  }
  packSelect.addEventListener('change',refreshPackControls);
  packButton.addEventListener('click',async()=>{
   const item=packs.find(p=>p.id===packSelect.value);
   if(!item||!map)return;
   if(googleActive)$('gm31-hide')?.click();
   online=false;activePack=item;setBasemap();
   map.fitBounds([[item.bounds[1],item.bounds[0]],[item.bounds[3],item.bounds[2]]],{animate:false,maxZoom:12});
  });
  function openMap() {
   if(!L) {
    status('Не найдена встроенная библиотека Leaflet. Воспользуйтесь кнопкой «Открыть OpenStreetMap» или переустановите программу.');
    return;
   }
   if(googleActive)return;
   if(!map) {
    surface.hidden=false;
    map=L.map(surface,{center:[56.35,43.5],zoom:8,minZoom:6,maxZoom:19,maxBoundsViscosity:.8,
       zoomControl:true,scrollWheelZoom:true,doubleClickZoom:true,boxZoom:true,keyboard:true,
       attributionControl:true,zoomAnimation:false,preferCanvas:true});
    setBasemap();
    loadPacks();
    markers=L.layerGroup().addTo(map);circles=L.layerGroup().addTo(map);trackLayer=L.layerGroup().addTo(map);
    map.on('click',e=>{
      const a=e.latlng;if(!valid(a.lat,a.lng))return;
      const lat=$('exp-my-lat'),lon=$('exp-my-lon');
      if(lat&&lon) {lat.value=a.lat.toFixed(6);lon.value=a.lng.toFixed(6);}
      status('GPS: '+a.lat.toFixed(6)+', '+a.lng.toFixed(6)+'. Координаты внесены в форму «Мои грибные места»; заполните название и нажмите «Сохранить».');
    });
   } else surface.hidden=false;
   // Leaflet должен получить действительные размеры ПОСЛЕ отображения страницы.
   w.requestAnimationFrame(()=>{map.invalidateSize({pan:false});redraw();});
  }
  function hideForGoogle(){googleActive=true;surface.hidden=true;}
  function restore(){googleActive=false;openMap();}
  function show() {
    if(!section.classList.contains('active'))return;
    openMap();
    // Начальный экран Экспедиции сразу открывается на карте и её инструментах.
    w.requestAnimationFrame(()=>w.requestAnimationFrame(()=>{
      if(section.classList.contains('active'))bar.scrollIntoView({block:'start',behavior:'auto'});
    }));
  }
  const results=$('fm32-results');
  const placeKinds={city:'город',town:'город',village:'село или посёлок',hamlet:'малый населённый пункт',isolated_dwelling:'отдельное поселение',locality:'местность'};
  function selectTown(place) {
    if(!map)return;
    results.hidden=true;
    if(searchMarker)searchMarker.remove();
    if(activePack){const [west,south,east,north]=activePack.bounds;if(place.lat<south||place.lat>north||place.lon<west||place.lon>east){activePack=null;setBasemap();}}
    map.setView([place.lat,place.lon],13,{animate:false});
    const label=d.createElement('span');label.textContent=place.name;
    searchMarker=L.circleMarker([place.lat,place.lon],{radius:7,color:'#153c38',fillColor:'#f7e4a0',fillOpacity:1,weight:2,interactive:false})
      .addTo(map).bindTooltip(label,{permanent:true,direction:'top',offset:[0,-6]});
    status('На карте: '+place.name+'.');
    try{w.localStorage.setItem('moolva-griby-last-place',JSON.stringify({name:place.name,lat:place.lat,lon:place.lon}));$('fm32-last').disabled=false;}catch{}
  }
  $('fm32-last').addEventListener('click',()=>{const place=getLastPlace();if(place&&valid(place.lat,place.lon))selectTown(place);});
  function nearbyTown(place){
   let nearest=null,distance=Infinity;
   for(const town of majorTowns){
    if(town.name===place.name&&town.lat===place.lat)continue;
    const current=(town.lat-place.lat)**2+((town.lon-place.lon)*.56)**2;
    if(current<distance){nearest=town;distance=current;}
   }
   return nearest?` · рядом с ${nearest.name}`:'';
  }
  function findTown(){
    const q=normalizeName($('fm32-town').value);
    results.replaceChildren();results.hidden=true;
    if(q.length<2){status('Введите хотя бы две буквы названия.');return;}
    const matches=searchable.filter(p=>p.query.includes(q));
    const exact=matches.filter(p=>p.query===q);
    if(!matches.length){status('Населённый пункт не найден в офлайн-справочнике.');return;}
    if(exact.length===1||matches.length===1){selectTown(exact[0]||matches[0]);return;}
    matches.sort((a,b)=>Number(b.query===q)-Number(a.query===q)||Number(b.query.startsWith(q))-Number(a.query.startsWith(q)));
    for(const p of matches.slice(0,8)){
     const button=d.createElement('button');button.type='button';button.className='exp-button';
     button.textContent=`${p.name} · ${placeKinds[p.kind]||'ориентир'}${nearbyTown(p)} · ${p.lat.toFixed(3)}, ${p.lon.toFixed(3)}`;
     button.addEventListener('click',()=>selectTown(p));results.append(button);
    }
    results.hidden=false;
    status('Найдено: '+matches.length+'. Выберите населённый пункт или уточните название.');
  }
  $('fm32-find').addEventListener('click',findTown);
  $('fm32-town').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();findTown();}});
  $('fm32-reset').addEventListener('click',()=>{
   show();results.hidden=true;searchMarker?.remove();searchMarker=null;
   if(map){if(activePack){activePack=null;setBasemap();}map.setView([56.35,43.5],8);}
  });
  $('fm32-switch').addEventListener('click',()=>{
   if(!map||!w.protomapsL)return;
   if(googleActive)restore();
   online=!online;setBasemap();redraw();
  });
  $('fm32-open-external').addEventListener('click',()=>{
    const c=map?map.getCenter():{lat:56.35,lng:43.5};
    const z=map?map.getZoom():8;
    const url='https://www.openstreetmap.org/#map='+z+'/'+Number(c.lat).toFixed(5)+'/'+Number(c.lng??c.lon).toFixed(5);
    w.open(url,'_blank','noopener,noreferrer');
  });
  w.addEventListener('moolva:expedition-shown',show);
  w.addEventListener('moolva:expedition-data-changed',redraw);
  w.addEventListener('moolva:expedition-selected',e=>{
    const p=e.detail;
    if(!p||!valid(p.lat,p.lon)||!map||googleActive)return;
    if(!map.getBounds().contains([p.lat,p.lon]))map.panTo([p.lat,p.lon]);
  });
  w.addEventListener('moolva:google-map-enabled',hideForGoogle);
  w.addEventListener('moolva:google-map-hidden',restore);
  for(const id of ['exp-reports','exp-observations','exp-personal','gm31-exact-checkbox'])$(id)?.addEventListener('change',redraw);
  $('fm34-species').addEventListener('input',redraw);
  $('fm34-age').addEventListener('change',redraw);
  $('exp-reports-list')?.addEventListener('click',e=>{
    const item=e.target.closest('[data-exp-report]');if(!item)return;
    const p=towns.find(x=>x.id===item.dataset.expReport);
    if(p&&map&&!googleActive){map.setView([p.lat,p.lon],12);redraw();}
  });
  w.addEventListener('resize',()=>{if(map&&!surface.hidden)map.invalidateSize({pan:false});});
  // Никаких сетевых обращений до открытия пользователем страницы.
  function fitTrack(points){
   if(!map||points.length<2)return;
   if(googleActive)$('gm31-hide')?.click();
   if(activePack){activePack=null;setBasemap();}
   map.fitBounds(points.map(p=>[p.lat,p.lon]),{padding:[18,18],maxZoom:15,animate:false});redraw();
  }
  w.MoOLVaFreeMap32={show,redraw,getMap:()=>map,getPoints:allPoints,isReady:()=>!!map,fitTrack,
    getStatus:()=>({loadedTiles,failedTiles,zoom:map?.getZoom()||null,markerCount:markers?.getLayers().length||0,online,localityCount:localities.length})};
 }
 return {valid,centerOf,present,collection,mount};
});
