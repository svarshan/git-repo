/* MoOLVa Грибы 3.2 — штатная бесплатная карта с Leaflet и OpenStreetMap.
   Leaflet поставляется вместе с EXE; картографические тайлы загружаются
   ТОЛЬКО при открытии Экспедиции и не сохраняются массово или офлайн.
   Публичные сообщения из соцсетей — приблизительные окрестности поселений.
 */
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
  const d=w.document, exp=w.MoOLVaExpedition30, box=d.getElementById('exp-map'), section=d.getElementById('expedition30');
  if(!exp||!box||!section||d.getElementById('fm32-map'))return;
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
  bar.innerHTML='<div class="fm32-header"><strong>🗺 Бесплатная карта с населёнными пунктами</strong><small>OpenStreetMap · без ключа и оплаты</small></div>'+
   '<p class="fm32-help">Колёсико мыши — масштаб; удерживайте мышь и перемещайте карту; кнопки + и − — увеличение. Нажмите на свободное место карты, чтобы заполнить координаты своей отметки.</p>'+
   '<div class="fm32-tools"><input id="fm32-town" list="fm32-localities" placeholder="Населённый пункт: Бор, Балахна, Фролищи…" autocomplete="off"><datalist id="fm32-localities"></datalist>'+
   '<button type="button" id="fm32-find" class="exp-button">⌕ Найти</button><button type="button" id="fm32-reset" class="exp-button">⌖ Вся область</button>'+
   '<button type="button" id="fm32-open-external" class="exp-button">↗ Открыть OpenStreetMap</button></div>'+
   '<p role="status" id="fm32-status" class="fm32-status">Карта будет загружена при открытии «Экспедиции»; необходим интернет.</p>';
  section.querySelector('.exp-map-shell').before(bar);
  const surface=d.createElement('div');surface.id='fm32-map';surface.className='fm32-map';surface.hidden=true;
  box.append(surface);
  const towns=(exp.reportData||[]).filter(x=>valid(x.lat,x.lon));
  const datalist=$('fm32-localities');
  for(const p of towns) {const op=d.createElement('option');op.value=p.name;datalist.append(op);}
  // Программа сохраняет те же локальные ключи, что и версии 3.0 и 3.1.
  function privatePoints(){try{const v=JSON.parse(w.localStorage.getItem('moolva-griby-v3-private-points')||'[]');return Array.isArray(v)?v.filter(x=>x&&valid(x.lat,x.lon)).slice(-600):[];}catch{return [];}}
  function privateTrack(){try{const v=JSON.parse(w.localStorage.getItem('moolva-griby-v3-private-track')||'[]');return Array.isArray(v)?v.filter(x=>x&&valid(x.lat,x.lon)).slice(-5000):[];}catch{return [];}}
  function layerFilters(){return {report:!!$('exp-reports')?.checked,observations:!!$('exp-observations')?.checked,personal:!!$('exp-personal')?.checked,
     exact:!!$('gm31-exact-checkbox')?.checked};}
  function exactPublic() {
    const api=w.MoOLVaGoogle31Core;
    return api&&typeof api.exactPublicObservations==='function'?api.exactPublicObservations(w.MOOLVA_REGION_OBS20||[]):[];
  }
  function allPoints(){return collection(exp,privatePoints(),exactPublic(),layerFilters());}
  function status(text){$('fm32-status').textContent=text;}
  let map=null,tiles=null,markers=null,circles=null,trackLayer=null,loadedTiles=0,failedTiles=0,googleActive=false,lastSelection=null;
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
      lastSelection=p;marker.openTooltip();
      if(p.kind==='public-exact')status(present(p)+' — откройте источник iNaturalist в карточке.');
    });
    markers.addLayer(marker);
    if(p.kind==='report') {
      // Окружность отражает приблизительный РАДИУС ПОИСКА, а не точное место находки.
      circles.addLayer(L.circle([p.lat,p.lon],{radius:p.approxKm*1000,color:'#e39b54',weight:1,
         fillColor:'#e39b54',fillOpacity:.055,interactive:false}));
    }
   }
   const route=privateTrack();
   if(route.length>1)trackLayer.addLayer(L.polyline(route.map(p=>[p.lat,p.lon]),{color:'#70c9f7',weight:3}));
   status('Нанесено '+points.length+' отметок; '+(loadedTiles?'подложка с населёнными пунктами загружена.':'подложка загружается…')+
      ' Оранжевые круги — приблизительные районы, не точные грибницы.');
  }
  function openMap() {
   if(!L) {
    status('Не найдена встроенная библиотека Leaflet. Воспользуйтесь кнопкой «Открыть OpenStreetMap» или переустановите программу.');
    return;
   }
   if(googleActive)return;
   if(!map) {
    surface.hidden=false;
    map=L.map(surface,{center:[56.35,43.5],zoom:8,minZoom:5,maxZoom:19,
       zoomControl:true,scrollWheelZoom:true,doubleClickZoom:true,boxZoom:true,keyboard:true,
       attributionControl:true,zoomAnimation:true,preferCanvas:true});
    tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
      maxZoom:19,minZoom:1,attribution:legal,keepBuffer:2,updateWhenIdle:true,
      className:'fm32-tiles'
    }).addTo(map);
    tiles.on('tileload',()=>{loadedTiles++;if(loadedTiles===1)status('Карта загрузилась: дороги и населённые пункты видны. Изменяйте масштаб колёсиком или кнопками + / −.');});
    tiles.on('tileerror',()=>{failedTiles++;if(failedTiles>=3&&loadedTiles===0)status('Не удаётся загрузить тайлы OpenStreetMap: проверьте интернет. Можно открыть карту в браузере кнопкой выше.');});
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
  // Можно искать по локальному словарю из реальных 12 районов.
  function findTown(){
    const q=$('fm32-town').value.trim().toLocaleLowerCase('ru');
    if(!q){status('Введите название населённого пункта из списка');return;}
    const matches=towns.filter(x=>x.name.toLocaleLowerCase('ru').includes(q)||x.area.toLocaleLowerCase('ru').includes(q));
    if(!matches.length){status('В локальном справочнике нет этого названия. Передвиньте карту вручную — сами населённые пункты подписаны на OpenStreetMap.');return;}
    const p=matches[0];if(typeof exp.selectPoint==='function')exp.selectPoint({...p,kind:'report'});
    show();
    if(map){map.setView([p.lat,p.lon],12);redraw();}
    status('Найден ориентир «'+p.name+'». Показаны окрестности, не точная грибница.');
  }
  $('fm32-find').addEventListener('click',findTown);
  $('fm32-town').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();findTown();}});
  $('fm32-reset').addEventListener('click',()=>{show();if(map)map.setView([56.35,43.5],8);});
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
    lastSelection=p;
    if(!map.getBounds().contains([p.lat,p.lon]))map.panTo([p.lat,p.lon]);
  });
  w.addEventListener('moolva:google-map-enabled',hideForGoogle);
  w.addEventListener('moolva:google-map-hidden',restore);
  for(const id of ['exp-reports','exp-observations','exp-personal','gm31-exact-checkbox'])$(id)?.addEventListener('change',redraw);
  $('exp-reports-list')?.addEventListener('click',e=>{
    const item=e.target.closest('[data-exp-report]');if(!item)return;
    const p=towns.find(x=>x.id===item.dataset.expReport);
    if(p&&map&&!googleActive){map.setView([p.lat,p.lon],12);redraw();}
  });
  w.addEventListener('resize',()=>{if(map&&!surface.hidden)map.invalidateSize({pan:false});});
  // Никаких сетевых обращений до открытия пользователем страницы.
  w.MoOLVaFreeMap32={show,redraw,getMap:()=>map,getPoints:allPoints,isReady:()=>!!map,
    getStatus:()=>({loadedTiles,failedTiles,zoom:map?.getZoom()||null,markerCount:markers?.getLayers().length||0})};
 }
 return {valid,centerOf,present,collection,mount};
});