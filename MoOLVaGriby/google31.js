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
  if(p?.kind==='personal')return 'Точная личная GPS-отметка (если введённые координаты измерены верно)';
  if(p?.kind==='report')return 'Только окрестности населённого пункта, ориентировочный радиус '+Number(p.approxKm||0)+' км';
  return 'Обобщённая ячейка iNaturalist (~10–20 км), не точное место находки';
 }
 function visiblePoints(exp,personal,enabled){
  const result=[];
  if(enabled.reports)for(const p of (exp?.reportData||[]))if(validCoord(p.lat,p.lon))result.push({...p,kind:'report'});
  if(enabled.observations)for(const p of (exp?.observationCells||[]))if(validCoord(p.lat,p.lon))result.push({...p,kind:'observations'});
  if(enabled.personal)for(const p of (personal||[]))if(validCoord(p.lat,p.lon))result.push({...p,kind:'personal'});
  return result;
 }
 function mount(w){
  const d=w.document,exp=w.MoOLVaExpedition30,page=d.getElementById('expedition30'),mapBox=d.getElementById('exp-map');
  if(!exp||!page||!mapBox||d.getElementById('gm31-panel'))return;
  const control=d.createElement('div');
  control.id='gm31-panel';
  control.innerHTML=
   '<div class="gm31-title"><strong>🛰 Google Maps · спутник и настоящие дороги</strong><span>Новый слой 3.1</span></div>'+
   '<p class="gm31-note">Google показывает местность с точными координатами, но не знает точных мест грибниц. Оранжевые маркеры — приблизительные районы сообщений; зелёные — обобщённые наблюдения; голубые — ваши точные отметки.</p>'+
   '<div class="gm31-controls"><button id="gm31-google-selected" class="exp-button" disabled>↗ Выбранная точка в Google Maps</button>'+
   '<label class="gm31-key-label"><span>Google Maps JavaScript API key</span><input type="password" id="gm31-api-key" autocomplete="off" spellcheck="false" placeholder="Вставьте свой API-ключ (только для сеанса)"></label>'+
   '<button class="exp-button" id="gm31-enable">🛰 Показать спутник Google</button><button class="exp-button" id="gm31-hide" hidden>⇦ Офлайн-карта</button></div>'+
   '<p id="gm31-status" class="gm31-status" role="status">Без ключа работает кнопка открытия координат в Google Maps. Встроенная карта требует подключённого Google Cloud Billing и Maps JavaScript API. Ключ не сохраняется.</p>';
  page.querySelector('.exp-map-shell').before(control);
  const canvas=d.createElement('div');canvas.className='gm31-google-canvas';canvas.id='gm31-google-canvas';canvas.hidden=true;
  mapBox.append(canvas);
  const $=id=>d.getElementById(id);
  const status=msg=>{$('gm31-status').textContent=msg;};
  let gm=null,googleLoaded=false,picked=null,loading=false,features=new Map(),circles=[],mapReady=false;
  let keyUsed='';
  function personal(){
   try{const x=JSON.parse(w.localStorage.getItem('moolva-griby-v3-private-points')||'[]');return Array.isArray(x)?x.filter(p=>p&&validCoord(p.lat,p.lon)).slice(-600):[];}
   catch{return [];}
  }
  function flags(){return {reports:!!$('exp-reports')?.checked,observations:!!$('exp-observations')?.checked,personal:!!$('exp-personal')?.checked};}
  function all(){return visiblePoints(exp,personal(),flags());}
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
    const color=kind==='personal'?'#47BBE6':kind==='report'?'#FFB366':'#77CD90';
    return {icon:{path:g.maps.SymbolPath.CIRCLE,scale:kind==='personal'?9:kind==='report'?7:5,
     strokeColor:'#112820',strokeWeight:2,fillColor:color,fillOpacity:.95},visible:true};
   });
   status('Google Maps активна: '+features.size+' геометок. Точные GPS есть только у личных меток; остальные места приблизительны.');
  }
  function select(p){
   if(!p||!googleUrl(p.lat,p.lon))return;
   picked=p;
   const link=googleUrl(p.lat,p.lon);
   const button=$('gm31-google-selected');
   button.disabled=false;
   button.title=pointAccuracy(p);
   if(gm){gm.panTo({lat:Number(p.lat),lng:Number(p.lon)});gm.setZoom(p.kind==='personal'?15:11);}
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
    if(p){if(typeof exp.selectPoint==='function')exp.selectPoint(p);select(p);}
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
  w.MoOLVaGoogle31={choose:select,getActive:()=>!canvas.hidden&&googleLoaded,getPoints:all,hasApiKey:()=>!!keyUsed};
 }
 return {validCoord,googleUrl,pointAccuracy,visiblePoints,mount};
});