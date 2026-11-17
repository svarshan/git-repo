/* MoOLVa Griby 3.1: optional official Google Maps JavaScript API integration.
   No Google map tiles copied, cached or bundled. No API key committed or persisted.
   Community markers refer to settlement centres, not precise mushroom locations. */
'use strict';
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root){root.MoOLVaGoogle31Core=api;if(root.document)root.addEventListener('DOMContentLoaded',()=>api.mount(root));}
})(typeof window!=='undefined'?window:null,function(){
 const LIMITS={south:54.1,north:58.2,west:41.2,east:48.2};
 function validCoord(lat,lon){
  const a=Number(lat),b=Number(lon);
  return Number.isFinite(a)&&Number.isFinite(b)&&a>=LIMITS.south&&a<=LIMITS.north&&b>=LIMITS.west&&b<=LIMITS.east;
 }
 function googleUrl(lat,lon){
  if(!validCoord(lat,lon))return null;
  return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(Number(lat).toFixed(6)+','+Number(lon).toFixed(6));
 }
 function pointAccuracy(p){
  if(p?.kind==='public-exact')return 'Открытое GPS-наблюдение iNaturalist; заявленная точность координат ±'+Number(p.accuracyM)+' м. Вид и повторное появление грибов не гарантированы';
  if(p?.kind==='personal')return 'Точная личная GPS-отметка (если введённые координаты измерены верно)';
  if(p?.kind==='report')return 'Только окрестности населённого пункта, ориентировочный радиус '+Number(p.approxKm||0)+' км';
  return 'Обобщённая ячейка iNaturalist (~10–20 км), не точное место находки';
 }
 const COMMON_SPECIES=new Set(['Boletus edulis','Leccinum scabrum','Cantharellus cibarius','Suillus luteus','Suillus granulatus']);
 function exactPublicObservations(rows){
  return (Array.isArray(rows)?rows:[]).filter(p=>p&&!p.obscured&&p.grade==='research'&&COMMON_SPECIES.has(p.latin)&&validCoord(p.lat,p.lon)&&Number(p.accuracyM)>=1&&Number(p.accuracyM)<=100&&/^https:\/\/www\.inaturalist\.org\/observations\/\d+$/.test(p.source||'')&&/^20\d{2}-\d\d-\d\d$/.test(p.date||'')).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,100).map(p=>({...p,kind:'public-exact'}));
 }
 function visiblePoints(exp,personal,enabled,exact=[]){
  const result=[];
  if(enabled.reports)for(const p of (exp?.reportData||[]))if(validCoord(p.lat,p.lon))result.push({...p,kind:'report'});
  if(enabled.observations)for(const p of (exp?.observationCells||[]))if(validCoord(p.lat,p.lon))result.push({...p,kind:'observations'});
  if(enabled.personal)for(const p of (personal||[]))if(validCoord(p.lat,p.lon))result.push({...p,kind:'personal'});
  if(enabled.exact)for(const p of exact)if(validCoord(p.lat,p.lon))result.push({...p,kind:'public-exact'});
  return result;
 }
 function mount(w){
  const d=w.document,exp=w.MoOLVaExpedition30,page=d.getElementById('expedition30'),mapBox=d.getElementById('exp-map');
  if(!exp||!page||!mapBox||d.getElementById('gm31-panel'))return;
  const control=d.createElement('div');
  control.id='gm31-panel';
  control.innerHTML=
   '<div class="gm31-title"><strong>🛰 Google Maps · спутник и настоящие дороги</strong><span>Новый слой 3.1</span></div>'+
   '<p class="gm31-note">Google показывает местность с точными координатами, но не знает точных мест грибниц. Оранжевые — районы сообщений; зелёные — обобщённые записи; голубые — личные GPS; фиолетовые — публичные GPS-наблюдения с указанной точностью.</p>'+
   '<div class="gm31-controls"><button id="gm31-google-selected" class="exp-button" disabled>↗ Выбранная точка в Google Maps</button>'+
   '<label class="gm31-key-label"><span>Google Maps JavaScript API key</span><input type="password" id="gm31-api-key" autocomplete="off" spellcheck="false" placeholder="Вставьте свой API-ключ (только для сеанса)"></label>'+
   '<button class="exp-button" id="gm31-enable">🛰 Показать спутник Google</button><button class="exp-button" id="gm31-hide" hidden>⇦ Офлайн-карта</button></div>'+
   '<p id="gm31-status" class="gm31-status" role="status">Без ключа работает открытие координат в Google Maps. Встроенная карта требует Google Cloud Billing и Maps JavaScript API. Ключ не сохраняется.</p>'+ 
   '<div class="gm31-exact"><label><input id="gm31-exact-checkbox" type="checkbox"> 🟣 Показывать публичные GPS-наблюдения распространённых грибов (точность 1–100 м)</label><p>Только открытые научно-гражданские наблюдения с датами и источником. GPS-точка не означает, что там сейчас есть грибы.</p><div id="gm31-exact-list"></div></div>';
  page.querySelector('.exp-map-shell').before(control);
  const canvas=d.createElement('div');canvas.className='gm31-google-canvas';canvas.id='gm31-google-canvas';canvas.hidden=true;
  mapBox.append(canvas);
  const $=id=>d.getElementById(id);
  const status=msg=>{$('gm31-status').textContent=msg;};
  let gm=null,googleLoaded=false,picked=null,loading=false,features=new Map(),circles=[],mapReady=false;
  const exact=exactPublicObservations(w.MOOLVA_REGION_OBS20||[]);
  let keyUsed='';
  function personal(){
   try{const x=JSON.parse(w.localStorage.getItem('moolva-griby-v3-private-points')||'[]');return Array.isArray(x)?x.filter(p=>p&&validCoord(p.lat,p.lon)).slice(-600):[];}
   catch{return [];}
  }
  function flags(){return {reports:!!$('exp-reports')?.checked,observations:!!$('exp-observations')?.checked,personal:!!$('exp-personal')?.checked,exact:!!$('gm31-exact-checkbox')?.checked};}
  function all(){return visiblePoints(exp,personal(),flags(),exact);}
  function clearFeatures(){
   if(!gm)return;
   gm.data.forEach(f=>gm.data.remove(f));circles.forEach(c=>c.setMap(null));circles=[];features.clear();
  }
  function paint(){
   if(!gm||!googleLoaded)return;
   clearFeatures();
   const g=w.google;
   let idx=0;
   for(const p of all()){
    const id='gm31-'+(idx++);
    const f=gm.data.add({id,geometry:new g.maps.Data.Point({lat:Number(p.lat),lng:Number(p.lon)}),properties:{kind:p.kind}});
    features.set(id,p);
    if(p.kind==='report'){
     circles.push(new g.maps.Circle({map:gm,center:{lat:Number(p.lat),lng:Number(p.lon)},radius:Number(p.approxKm)*1000,
      strokeColor:'#D8882E',strokeWeight:1,strokeOpacity:.68,fillColor:'#EFB469',fillOpacity:.055,clickable:false}));
    }
   }
   gm.data.setStyle(feature=>{
    const kind=feature.getProperty('kind');
    const color=kind==='public-exact'?'#C67EF4':kind==='personal'?'#47BBE6':kind==='report'?'#FFB366':'#77CD90';
    return {icon:{path:g.maps.SymbolPath.CIRCLE,scale:kind==='personal'?9:kind==='report'?7:5,
     strokeColor:'#112820',strokeWeight:2,fillColor:color,fillOpacity:.95},visible:true};
   });
   status('Google Maps активна: '+features.size+' геометок. Точные личные GPS и '+(flags().exact?exact.length:0)+' публичных GPS-наблюдений; остальные точки приблизительны.');
  }
  function select(p){
   if(!p||!googleUrl(p.lat,p.lon))return;
   picked=p;
   const link=googleUrl(p.lat,p.lon);
   const button=$('gm31-google-selected');
   button.disabled=false;
   button.title=pointAccuracy(p);
   if(gm){gm.panTo({lat:Number(p.lat),lng:Number(p.lon)});gm.setZoom(p.kind==='personal'||p.kind==='public-exact'?15:11);}
   if(p.kind==='public-exact'){$('exp-info-title').textContent=p.latin+' · GPS-наблюдение';$('exp-info-text').textContent=p.date+' · GPS ±'+p.accuracyM+' м. Публичное наблюдение не гарантирует вид и наличие грибов сегодня.';$('exp-info-extra').innerHTML='';const src=d.createElement('a');src.href=p.source;src.rel='noopener noreferrer';src.target='_blank';src.textContent='↗ Оригинал наблюдения iNaturalist';$('exp-info-extra').append(src);}
   const panel=$('exp-info-extra');
   if(panel){
    let a=panel.querySelector('[data-gm31-link]');
    if(!a){a=d.createElement('a');a.dataset.gm31Link='true';a.rel='noopener noreferrer';a.target='_blank';a.style.display='block';a.style.marginTop='12px';panel.append(a);}
    a.href=link;a.textContent='↗ Показать это место в Google Maps';
    let note=panel.querySelector('[data-gm31-note]');
    if(!note){note=d.createElement('p');note.dataset.gm31Note='true';panel.append(note);}
    note.textContent=pointAccuracy(p);
   }
  }
  function setupGoogle(){
   if(!w.google?.maps?.Map)throw Error('Библиотека Google Maps не загружена');
   const g=w.google;
   gm=new g.maps.Map(canvas,{center:{lat:56.35,lng:43.6},zoom:8,mapTypeId:'hybrid',
    mapTypeControl:true,streetViewControl:false,fullscreenControl:true,gestureHandling:'greedy'});
   gm.data.addListener('click',e=>{
    const p=features.get(e.feature.getId());
    if(p){if(p.kind!=='public-exact'&&typeof exp.selectPoint==='function')exp.selectPoint(p);select(p);}
   });
   gm.addListener('click',e=>{
    const lat=e.latLng?.lat(),lon=e.latLng?.lng();
    if(!validCoord(lat,lon))return;
    const latEl=$('exp-my-lat'),lonEl=$('exp-my-lon');
    if(latEl&&lonEl){latEl.value=lat.toFixed(6);lonEl.value=lon.toFixed(6);
     status('Точные координаты '+lat.toFixed(6)+', '+lon.toFixed(6)+' перенесены в форму «Мои грибные места». Укажите название и сохраните точку.');}
   });
   googleLoaded=true;mapReady=true;canvas.hidden=false;
   $('gm31-hide').hidden=false;$('gm31-enable').hidden=true;
   paint();
  }
  function loadGoogle(key){
   if(googleLoaded){canvas.hidden=false;$('gm31-hide').hidden=false;$('gm31-enable').hidden=true;paint();return;}
   if(loading)return;
   if(!/^[A-Za-z0-9_-]{20,160}$/.test(key)){status('Не указан корректный API-ключ Google Maps. Используйте ссылки Google Maps без ключа либо введите свой ключ.');return;}
   if(!w.confirm('Google Maps отправит запросы в Google и может тарифицироваться. Для встроенной карты ключ остаётся видимым в сетевых запросах; ограничьте его доступ к Maps JavaScript API и установите квоты. Подключить?'))return;
   loading=true;keyUsed=key;status('Подключение к Google Maps. При отказе в доступе проверьте ограничения ключа и Billing.');
   canvas.hidden=false; // initialize the map in a visible container
   if(w.google?.maps?.Map){try{setupGoogle();}catch(err){canvas.hidden=true;status('Ошибка Google Maps: '+err.message);}finally{loading=false;}return;}
   const script=d.createElement('script');
   const callback='__MoOLVaGoogle31Init';
   let timeout=setTimeout(()=>{if(loading){loading=false;canvas.hidden=true;status('Google Maps не ответила. Проверьте интернет, ключ и Billing.');}},16000);
   w[callback]=()=>{clearTimeout(timeout);loading=false;try{setupGoogle();}catch(err){canvas.hidden=true;status('Ошибка запуска: '+err.message);}};
   w.gm_authFailure=()=>{clearTimeout(timeout);loading=false;googleLoaded=false;canvas.hidden=true;status('Google отклонил ключ. Проверьте HTTP-referrer, Maps JavaScript API и Billing в Google Cloud Console.');};
   script.onerror=()=>{clearTimeout(timeout);loading=false;canvas.hidden=true;status('Не удалось загрузить библиотеку Google Maps. Ссылки на Google Maps продолжают работать.');};
   script.src='https://maps.googleapis.com/maps/api/js?key='+encodeURIComponent(key)+'&v=weekly&loading=async&language=ru&region=RU&callback='+callback;
   script.async=true;d.head.append(script);
  }
  $('gm31-exact-checkbox').addEventListener('change',()=>{if(googleLoaded)paint();});
  $('gm31-exact-list').innerHTML=exact.length?exact.slice(0,40).map((p,i)=>'<button class="gm31-exact-item" data-gm31-obs="'+i+'"><strong>'+p.latin+'</strong><span>'+p.date+' · GPS ±'+p.accuracyM+' м</span></button>').join(''):'<p>Нет опубликованных GPS-наблюдений с заявленной точностью до 100 м среди проверяемых распространённых видов в текущем региональном наборе.</p>';
  $('gm31-exact-list').addEventListener('click',e=>{const b=e.target.closest('[data-gm31-obs]');if(!b)return;const p=exact[Number(b.dataset.gm31Obs)];if(p)select(p);});
  $('gm31-google-selected').addEventListener('click',()=>{const u=picked&&googleUrl(picked.lat,picked.lon);if(u)w.open(u,'_blank','noopener,noreferrer');});
  $('gm31-enable').addEventListener('click',()=>loadGoogle($('gm31-api-key').value.trim()));
  $('gm31-hide').addEventListener('click',()=>{canvas.hidden=true;$('gm31-hide').hidden=true;$('gm31-enable').hidden=false;status('Офлайн-координатная схема включена. Google-карта скрыта.');});
  w.addEventListener('moolva:expedition-selected',e=>select(e.detail));
  w.addEventListener('moolva:expedition-data-changed',()=>{if(googleLoaded)paint();});
  w.addEventListener('moolva:expedition-shown',()=>{if(googleLoaded){w.requestAnimationFrame(()=>{gm.setCenter(gm.getCenter());paint();});}});
  for(const id of ['exp-reports','exp-observations','exp-personal'])$(id)?.addEventListener('change',()=>{if(googleLoaded)paint();});
  $('exp-reports-list')?.addEventListener('click',e=>{
   const item=e.target.closest('[data-exp-report]');if(!item)return;
   const p=exp.reportData.find(x=>x.id===item.dataset.expReport);
   if(p)select({...p,kind:'report'});
  });
  w.MoOLVaGoogle31={choose:select,getActive:()=>!canvas.hidden&&googleLoaded,getPoints:all,getExactCount:()=>exact.length,hasApiKey:()=>!!keyUsed};
 }
 return {validCoord,googleUrl,pointAccuracy,visiblePoints,exactPublicObservations,mount};
});