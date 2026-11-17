/* MoOLVa Грибы 3.0 — Экспедиция. All social anchors refer to locality centres, NOT collection GPS. */
'use strict';
(function(root,factory){
 const api=factory(); if(typeof module==='object'&&module.exports)module.exports=api;
 if(root){root.MoOLVaExpeditionCore30=api; if(root.document)root.addEventListener('DOMContentLoaded',()=>api.mount(root));}
})(typeof window!=='undefined'?window:null,function(){
 const bounds={west:41.2,east:48.2,south:54.1,north:58.2};
 function validCoordinate(lat,lon){return Number.isFinite(Number(lat))&&Number.isFinite(Number(lon))&&Number(lat)>=bounds.south&&Number(lat)<=bounds.north&&Number(lon)>=bounds.west&&Number(lon)<=bounds.east;}
 function acceptedReport(x){return !!(x&&/^[a-z0-9_-]{2,40}$/.test(x.id)&&typeof x.name==='string'&&x.name.length<90&&validCoordinate(x.lat,x.lon)&&Number(x.approxKm)>=1&&Number(x.approxKm)<=40&&/^202[0-9]-\d\d-\d\d$/.test(x.reported)&&/^https:\/\/(www\.nn\.ru|nn\.aif\.ru|niann\.ru)\/[^\s]*$/.test(x.source));}
 function projected(lat,lon){return {x:(Number(lon)-bounds.west)/(bounds.east-bounds.west),y:(bounds.north-Number(lat))/(bounds.north-bounds.south)};}
 function aggregate(rows,step=0.16){const cells=new Map();for(const o of Array.isArray(rows)?rows:[]){if(!validCoordinate(o?.lat,o?.lon)||o.obscured||o.grade!=='research')continue;const lat=Math.floor(Number(o.lat)/step)*step+step/2,lon=Math.floor(Number(o.lon)/step)*step+step/2;const k=lat.toFixed(3)+'/'+lon.toFixed(3);let item=cells.get(k);if(!item){item={kind:'observations',lat,lon,count:0,names:new Set(),year:0};cells.set(k,item);}item.count++;if(o.latin)item.names.add(String(o.latin));item.year=Math.max(item.year,Number(String(o.date||'').slice(0,4))||0);}return [...cells.values()].map(x=>({...x,names:[...x.names].slice(0,6)})).filter(x=>validCoordinate(x.lat,x.lon));}
 function importPoint(raw){if(!raw||typeof raw!=='object'||!validCoordinate(raw.lat,raw.lon))return null;const name=String(raw.name||'Моя отметка').trim().slice(0,90);if(!name)return null;return {id:String(raw.id||('p-'+Date.now()+'-'+Math.random().toString(36).slice(2))).slice(0,90),name,lat:+raw.lat,lon:+raw.lon,note:String(raw.note||'').slice(0,500),date:/^\d{4}-\d{2}-\d{2}$/.test(raw.date||'')?raw.date:new Date().toISOString().slice(0,10),kind:'personal'};}
 function xmlEscape(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));}
 function gpx(points,track){const nodes=(points||[]).filter(x=>validCoordinate(x.lat,x.lon)).slice(0,1000).map(x=>'<wpt lat="'+x.lat+'" lon="'+x.lon+'"><name>'+xmlEscape(x.name)+'</name><desc>'+xmlEscape(x.note||'')+'</desc></wpt>').join('');
 const line=(track||[]).filter(x=>validCoordinate(x.lat,x.lon)).slice(0,5000).map(x=>'<trkpt lat="'+x.lat+'" lon="'+x.lon+'"/>').join('');
 return '<?xml version="1.0" encoding="UTF-8"?><gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="MoOLVa Griby 3.0">'+nodes+(line?'<trk><name>Мой маршрут</name><trkseg>'+line+'</trkseg></trk>':'')+'</gpx>';}
 function mount(w){
 const doc=w.document,main=doc.querySelector('main'),nav=doc.querySelector('.sidebar nav');
 if(!main||!nav||doc.getElementById('expedition30'))return;
 const esc=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const reportData=(w.MOOLVA_COMMUNITY30||[]).filter(acceptedReport);
 const obs=aggregate((w.MOOLVA_REGION_OBS20||[]).filter(x=>x&&!x.obscured&&x.grade==='research'));
 const pointKey='moolva-griby-v3-private-points',trackKey='moolva-griby-v3-private-track';
 function fromStorage(key){try{const x=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(x)?x:[];}catch{return [];}}
 let mine=fromStorage(pointKey).map(importPoint).filter(Boolean).slice(-600);
 let track=fromStorage(trackKey).filter(x=>validCoordinate(x.lat,x.lon)).slice(-5000);
 let enabled={reports:true,observations:true,personal:true};
 let picked=null,zoom=8,center={lat:56.35,lon:43.50},online=false;
 const entry=doc.createElement('button');entry.type='button';entry.dataset.expedition30='open';entry.innerHTML='<span>🧭</span> Экспедиция 3.0';nav.append(entry);
 const section=doc.createElement('section');section.className='page';section.id='expedition30';
 section.innerHTML='<div class="sectiontop"><div><span class="eyebrow">MoOLVa Грибы 3.0 · Нижегородская область</span><h2>Экспедиция · карта грибных мест</h2></div></div>'+
 '<div class="exp-warning">📍 <b>Геометки соцсетей — ориентиры у населённых пунктов, не координаты грибных полян.</b> Результаты 2026 года не гарантируют находок в другой день. Обозначения грибов не подтверждают их съедобность.</div>'+
 '<div class="exp-summary"><div><strong id="exp-count-reports"></strong><span>районов из сообщений грибников</span></div><div><strong id="exp-count-observations"></strong><span>обобщённых ячеек наблюдений</span></div><div><strong id="exp-count-personal"></strong><span>моих точек</span></div></div>'+
 '<div class="exp-toolbar"><label><input type="checkbox" id="exp-reports" checked> 🟠 Сообщения грибников</label><label><input type="checkbox" id="exp-observations" checked> 🟢 iNaturalist (обобщённо)</label><label><input type="checkbox" id="exp-personal" checked> 🔵 Мои места</label>'+
 '<button id="exp-online" class="exp-button">🌐 Подключить карту OSM</button><button id="exp-reset-view" class="exp-button">⌖ Вся область</button></div>'+
 '<div class="exp-map-shell"><div class="exp-map" id="exp-map" role="application" aria-label="Интерактивная карта грибных мест"><div id="exp-tiles" class="exp-tiles"></div><div class="exp-grid" id="exp-grid"></div><div id="exp-map-pins" class="exp-map-pins"></div><div class="exp-map-controls"><button id="exp-zoom-in" aria-label="Увеличить">+</button><button id="exp-zoom-out" aria-label="Уменьшить">−</button></div><div class="exp-map-attrib" id="exp-attribution">Офлайн-схема координат · Без подложки дорог</div></div>'+
 '<div class="exp-map-info"><h3 id="exp-info-title">Выберите отметку</h3><p id="exp-info-text">Нажмите на точку для просмотра даты, описания и источника. Колёсико увеличивает карту; мышью можно перемещать.</p><div id="exp-info-extra"></div></div></div>'+
 '<div class="exp-details"><div class="exp-panel"><h3>Публичные сообщения грибников</h3><p>Отметки сформированы из публикаций, пересказывающих открытые сообщения во ВКонтакте. Географический якорь — центр названного поселения. Сортировка по дате публикации.</p><input id="exp-search" placeholder="Найти район или гриб…"><div id="exp-reports-list" class="exp-reports-list"></div></div>'+
 '<div class="exp-panel"><h3>Мои грибные места и маршруты</h3><p>Эти записи остаются на вашем ПК. Публичным источникам координаты не отправляются.</p>'+
 '<form id="exp-my-form" class="exp-form"><input id="exp-my-name" required maxlength="90" placeholder="Название места"><div class="exp-two"><input id="exp-my-lat" type="number" required step="any" min="54.1" max="58.2" placeholder="Широта"><input id="exp-my-lon" type="number" required step="any" min="41.2" max="48.2" placeholder="Долгота"></div><input id="exp-my-note" maxlength="500" placeholder="Что нашли (необязательно)"><button class="primary" type="submit">＋ Сохранить личную точку</button></form>'+
 '<div class="exp-ops"><button class="exp-button" id="exp-gps">⌖ Определить мои координаты</button><button class="exp-button" id="exp-json-out">⇩ Резерв JSON</button><button class="exp-button" id="exp-gpx-out">⇩ Экспорт GPX</button><label class="exp-upload">⇧ Импорт GPX / JSON<input type="file" id="exp-import" accept=".gpx,.json,application/json,application/gpx+xml" hidden></label><button class="exp-button" id="exp-clear-track">Сбросить маршрут</button></div><p id="exp-private-status"></p><div id="exp-personal-list"></div></div></div>'+
 '<div class="exp-footnote">Источники: публикации СМИ со ссылками в карточках; научно-гражданские наблюдения iNaturalist — только открытые геоданные с обобщением по сетке ~10–20 км. Подключаемый дорожный слой: © OpenStreetMap contributors. Офлайн доступны отметки и координатная схема, <b>полноценные офлайн-тайлы пока не включены</b>. Для GPX используйте треки, полученные законно и с разрешением владельца.</div>';
 main.append(section);
 const $=id=>doc.getElementById(id);
 function setCounts(){$('exp-count-reports').textContent=reportData.length;$('exp-count-observations').textContent=obs.length;$('exp-count-personal').textContent=mine.length;}
 function save(){localStorage.setItem(pointKey,JSON.stringify(mine));localStorage.setItem(trackKey,JSON.stringify(track));setCounts();w.dispatchEvent(new w.CustomEvent('moolva:expedition-data-changed'));}
 function show(){doc.querySelectorAll('section.page').forEach(x=>x.classList.toggle('active',x===section));doc.querySelectorAll('.sidebar button').forEach(x=>x.classList.toggle('selected',x===entry));$('heading').textContent='Экспедиция 3.0';$('subtitle').textContent='Публичные сообщения, обобщённые наблюдения и личные маршруты';draw();w.dispatchEvent(new w.CustomEvent('moolva:expedition-shown'));w.scrollTo(0,0);}
 entry.addEventListener('click',show);
 const box=$('exp-map');let mapW=900,mapH=560;
 function worldPx(lat,lon,z){const size=256*Math.pow(2,z),clamp=Math.max(-85.0511,Math.min(85.0511,lat)),r=clamp*Math.PI/180;return{x:(lon+180)/360*size,y:(1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*size};}
 function fromPx(x,y,z){const size=256*Math.pow(2,z),lon=x/size*360-180,n=Math.PI*(1-2*y/size);return{lat:180/Math.PI*Math.atan(Math.sinh(n)),lon};}
 function loc(lat,lon){const o=worldPx(lat,lon,zoom),c=worldPx(center.lat,center.lon,zoom);return{x:o.x-c.x+mapW/2,y:o.y-c.y+mapH/2};}
 function candidates(){const a=[];if(enabled.reports)a.push(...reportData.map(x=>({...x,kind:'report'})));if(enabled.observations)a.push(...obs);if(enabled.personal)a.push(...mine);return a;}
 function draw(){
 mapW=box.clientWidth||900;mapH=box.clientHeight||560;const c=worldPx(center.lat,center.lon,zoom);
 const tiles=$('exp-tiles'),grid=$('exp-grid'),pins=$('exp-map-pins');
 if(online){const count=Math.pow(2,zoom),startX=Math.floor((c.x-mapW/2)/256),endX=Math.floor((c.x+mapW/2)/256),startY=Math.floor((c.y-mapH/2)/256),endY=Math.floor((c.y+mapH/2)/256);let s='';
 for(let x=startX;x<=endX;x++)for(let y=startY;y<=endY;y++){if(y<0||y>=count)continue;const xx=((x%count)+count)%count,left=x*256-c.x+mapW/2,top=y*256-c.y+mapH/2;s+='<img alt="" draggable="false" loading="lazy" style="left:'+left+'px;top:'+top+'px" src="https://tile.openstreetmap.org/'+zoom+'/'+xx+'/'+y+'.png">';}tiles.innerHTML=s;grid.innerHTML='';}
 else{tiles.innerHTML='';const h=[];for(let lat=54;lat<=59;lat+=.5){let p=loc(lat,41.2);if(p.y<0||p.y>mapH)continue;h.push('<div class="exp-lat-line" style="top:'+p.y+'px"><span>'+lat+'°N</span></div>');}for(let lon=41;lon<=49;lon+=.5){let p=loc(56,lon);if(p.x<0||p.x>mapW)continue;h.push('<div class="exp-lon-line" style="left:'+p.x+'px"><span>'+lon+'°E</span></div>');}grid.innerHTML=h.join('');}
 $('exp-attribution').textContent=online?'© OpenStreetMap contributors · Онлайн-слой':'Офлайн: координатная схема · не топографическая карта';
 let html='',points=candidates();points.forEach((p,i)=>{const xy=loc(p.lat,p.lon);if(xy.x< -30||xy.x>mapW+30||xy.y< -30||xy.y>mapH+30)return;
 const cls=p.kind==='report'?'report':p.kind==='personal'?'personal':'observations';
 html+='<button type="button" title="'+esc(p.kind==='report'?p.name:p.kind==='personal'?p.name:'Обобщённые наблюдения')+'" aria-label="'+esc(p.name||'Наблюдения')+'" class="exp-pin exp-pin-'+cls+'" data-exp-pin="'+i+'" style="left:'+xy.x+'px;top:'+xy.y+'px">'+(p.kind==='observations'?p.count:'')+'</button>';
 });pins.innerHTML=html;box._points=points;
 if(track.length>1){const poly=track.map(p=>loc(p.lat,p.lon)).map(p=>p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ');pins.insertAdjacentHTML('afterbegin','<svg class="exp-track" width="'+mapW+'" height="'+mapH+'"><polyline points="'+poly+'" fill="none" stroke="#72c6ff" stroke-width="3" stroke-linejoin="round"/></svg>');}
 }
 function choose(p){
 picked=p;$('exp-info-title').textContent=p.kind==='report'?p.name:p.kind==='personal'?p.name:'Наблюдения iNaturalist';
 if(p.kind==='report'){$('exp-info-text').textContent=p.area+' · Публикация '+p.reported+'. '+p.species+'. '+p.details;
 $('exp-info-extra').innerHTML='<p><b>Ориентир: населённый пункт, не точная поляна.</b> Источник пересказывает публичное сообщение.</p><a href="'+esc(p.source)+'" target="_blank" rel="noopener noreferrer">Открыть источник ↗</a>';}
 else if(p.kind==='observations'){$('exp-info-text').textContent='В этой обобщённой геоячейке опубликовано наблюдений: '+p.count+'. Примеры научных названий: '+p.names.join(', ')+'. Данные не являются картой съедобности.';
 $('exp-info-extra').innerHTML='<p>Примерная сетка, точные координаты исходных наблюдений не показываются.</p><a href="https://www.inaturalist.org/observations?place_id=134584&taxon_id=47170" target="_blank" rel="noopener noreferrer">iNaturalist ↗</a>';}
 else{$('exp-info-text').textContent='Приватная точка: '+p.lat.toFixed(5)+', '+p.lon.toFixed(5)+'. '+p.note;
 $('exp-info-extra').innerHTML='<button type="button" data-exp-delete="'+esc(p.id)+'" class="exp-button">Удалить точку</button>';} w.dispatchEvent(new w.CustomEvent('moolva:expedition-selected',{detail:p}));
 }
 function list(){let q=$('exp-search').value.toLowerCase().trim();$('exp-reports-list').innerHTML=reportData.filter(x=>(x.name+' '+x.area+' '+x.species).toLowerCase().includes(q)).sort((a,b)=>b.reported.localeCompare(a.reported)).map(x=>'<button type="button" data-exp-report="'+esc(x.id)+'"><b>'+esc(x.name)+'</b><span>'+esc(x.species)+' · '+esc(x.reported)+'</span><small>'+esc(x.area)+' · приблизительный район</small></button>').join('')||'<p>Ничего не найдено</p>';
 $('exp-personal-list').innerHTML=mine.map(x=>'<div class="exp-private-row">'+esc(x.name)+' · '+x.lat.toFixed(4)+', '+x.lon.toFixed(4)+'</div>').join('');setCounts();}
 function download(filename,text,mime){const url=URL.createObjectURL(new Blob([text],{type:mime}));const a=doc.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
 function zoomTo(lat,lon,z){center={lat,lon};zoom=z;draw();}
 function zoomAt(direction){const n=Math.max(6,Math.min(14,zoom+direction));zoom=n;draw();}
 $('exp-map-pins').addEventListener('click',e=>{const b=e.target.closest('[data-exp-pin]');if(b)choose(box._points[Number(b.dataset.expPin)]);});
 $('exp-reports-list').addEventListener('click',e=>{const b=e.target.closest('[data-exp-report]');if(!b)return;const p=reportData.find(x=>x.id===b.dataset.expReport);if(p){enabled.reports=true;$('exp-reports').checked=true;zoomTo(p.lat,p.lon,10);choose({...p,kind:'report'});}});
 $('exp-info-extra').addEventListener('click',e=>{const b=e.target.closest('[data-exp-delete]');if(b&&w.confirm('Удалить вашу личную отметку?')){mine=mine.filter(x=>x.id!==b.dataset.expDelete);save();list();draw();$('exp-info-extra').textContent='Отметка удалена';}});
 for(const [key,id] of [['reports','exp-reports'],['observations','exp-observations'],['personal','exp-personal']])$(id).addEventListener('change',()=>{enabled[key]=$(id).checked;draw();});
 $('exp-search').addEventListener('input',list);
 $('exp-online').addEventListener('click',()=>{online=!online;$('exp-online').textContent=online?'🌐 Выключить онлайн-карту':'🌐 Подключить карту OSM';draw();});
 $('exp-reset-view').addEventListener('click',()=>zoomTo(56.35,43.5,8));
 $('exp-zoom-in').addEventListener('click',()=>zoomAt(1));$('exp-zoom-out').addEventListener('click',()=>zoomAt(-1));
 box.addEventListener('wheel',e=>{e.preventDefault();zoomAt(e.deltaY<0?1:-1);},{passive:false});
 let drag=null;box.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;drag={x:e.clientX,y:e.clientY,c:worldPx(center.lat,center.lon,zoom)};box.setPointerCapture(e.pointerId);});
 box.addEventListener('pointermove',e=>{if(!drag)return;const next=fromPx(drag.c.x+drag.x-e.clientX,drag.c.y+drag.y-e.clientY,zoom);center={lat:Math.max(bounds.south,Math.min(bounds.north,next.lat)),lon:Math.max(bounds.west,Math.min(bounds.east,next.lon))};draw();});
 box.addEventListener('pointerup',()=>{drag=null;});box.addEventListener('pointercancel',()=>{drag=null;});
 $('exp-my-form').addEventListener('submit',e=>{e.preventDefault();const p=importPoint({name:$('exp-my-name').value,lat:Number($('exp-my-lat').value),lon:Number($('exp-my-lon').value),note:$('exp-my-note').value});if(!p){$('exp-private-status').textContent='Проверьте координаты Нижегородской области';return;}mine.push(p);mine=mine.slice(-600);save();list();draw();choose(p);$('exp-my-name').value='';$('exp-my-note').value='';$('exp-private-status').textContent='Точка сохранена локально';});
 $('exp-gps').addEventListener('click',()=>{if(!navigator.geolocation){$('exp-private-status').textContent='Геолокация недоступна. Введите координаты вручную.';return;}navigator.geolocation.getCurrentPosition(x=>{$('exp-my-lat').value=x.coords.latitude;$('exp-my-lon').value=x.coords.longitude;$('exp-private-status').textContent='Координаты считаны. Уточните название и нажмите «Сохранить».';},()=>{$('exp-private-status').textContent='Разрешение на геолокацию не получено. Введите координаты вручную.';},{timeout:9000,enableHighAccuracy:true});});
 $('exp-json-out').addEventListener('click',()=>download('MoOLVa-Griby-3.0-my-places.json',JSON.stringify({schema:3,points:mine,track},null,2),'application/json'));
 $('exp-gpx-out').addEventListener('click',()=>download('MoOLVa-Griby-3.0-route.gpx',gpx(mine,track),'application/gpx+xml'));
 $('exp-clear-track').addEventListener('click',()=>{if(w.confirm('Удалить импортированный маршрут? Личные точки останутся.')){track=[];save();draw();}});
 $('exp-import').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>2500000)throw Error('Слишком большой файл (максимум 2,5 МБ)');const t=await file.text();let pts=[],trk=[];
 if(/\.json$/i.test(file.name)){const j=JSON.parse(t);if(j.schema!==3||!Array.isArray(j.points))throw Error('Неизвестный формат JSON');pts=j.points.map(importPoint).filter(Boolean).slice(-600);trk=(Array.isArray(j.track)?j.track:[]).filter(x=>validCoordinate(x.lat,x.lon)).slice(-5000);}
 else if(/\.gpx$/i.test(file.name)){const xml=new DOMParser().parseFromString(t,'application/xml');if(xml.querySelector('parsererror'))throw Error('Ошибочный GPX');pts=[...xml.getElementsByTagName('wpt')].slice(0,600).map(x=>importPoint({lat:x.getAttribute('lat'),lon:x.getAttribute('lon'),name:x.getElementsByTagName('name')[0]?.textContent||'GPX метка'})).filter(Boolean);trk=[...xml.getElementsByTagName('trkpt')].slice(0,5000).map(x=>({lat:Number(x.getAttribute('lat')),lon:Number(x.getAttribute('lon'))})).filter(x=>validCoordinate(x.lat,x.lon));}
 else throw Error('Поддерживаются только GPX и JSON');
 if(!w.confirm('Добавить '+pts.length+' точек и заменить маршрут ('+trk.length+' узлов)?'))return;const ids=new Set(mine.map(x=>x.id));for(const p of pts){if(!ids.has(p.id)){mine.push(p);ids.add(p.id);}}mine=mine.slice(-600);track=trk;save();list();draw();$('exp-private-status').textContent='Импорт завершён: '+pts.length+' точек, '+trk.length+' узлов маршрута.';}
 catch(err){$('exp-private-status').textContent='Импорт отменён: '+err.message;}finally{e.target.value='';}});
 w.addEventListener('resize',()=>{if(section.classList.contains('active'))draw();});
 setCounts();list();
 w.MoOLVaExpedition30={show,reportData,observationCells:obs,selectPoint:choose,getSelection:()=>picked};
 }
 return {bounds,validCoordinate,acceptedReport,projected,aggregate,importPoint,xmlEscape,gpx,mount};
});