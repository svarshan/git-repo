'use strict';
(() => {
  const keys={basic:'moolva-griby-1.0-data',points:'moolva-griby-v3-private-points',track:'moolva-griby-v3-private-track',geo:'moolva-griby-v2-my-coordinates',trips:'moolva-griby-v34-trips'};
  const $=id=>document.getElementById(id);
  const array=value=>Array.isArray(value)?value:[];
  const text=(value,limit)=>typeof value==='string'?value.slice(0,limit):'';
  const date=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')?value:'';
  const dateToday=()=>new Intl.DateTimeFormat('sv-SE').format(new Date());
  function read(key,fallback) {try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
  function coordinate(item) {
    const valid=window.MoOLVaExpeditionCore30?.validCoordinate;
    return item && typeof item.lat==='number' && typeof item.lon==='number' && valid?.(item.lat,item.lon);
  }
  const cleanTrack=value=>array(value).filter(coordinate).slice(-5000).map(({lat,lon})=>({lat,lon}));
  function cleanBackup(input) {
    const species=new Set((window.MOOLVA_MUSHROOMS||[]).map(x=>x.id));
    const source=input?.schema===34?input.data:input?.schema===1?{basic:input}:input?.schema===3?input:null;
    if(!source||typeof source!=='object')throw new Error('Формат резервной копии не распознан.');
    const basic=source.basic||{};
    const favorites=array(basic.favorites).filter(x=>species.has(x));
    const diary=array(basic.diary).filter(x=>x&&species.has(x.speciesId)&&typeof x.id==='string'&&date(x.date)&&text(x.place,100))
      .slice(-1000).map(x=>({id:text(x.id,100),speciesId:x.speciesId,place:text(x.place,100),date:x.date,notes:text(x.notes,1000)}));
    const importPoint=window.MoOLVaExpeditionCore30?.importPoint;
    const points=array(source.points).filter(coordinate).slice(-600).map(x=>importPoint?.(x)).filter(Boolean);
    const geo=array(source.geo).filter(coordinate).slice(-300).map(x=>({id:text(x.id,100),label:text(x.label,100),note:text(x.note,500),lat:x.lat,lon:x.lon,date:date(x.date)}));
    const trips=array(source.trips).filter(x=>x&&typeof x.id==='string'&&date(x.date)&&text(x.name,100)).map(x=>({
      id:text(x.id,100),name:text(x.name,100),notes:text(x.notes,1000),date:x.date,track:cleanTrack(x.track)
    }));
    return {basic:{favorites,diary},points,track:cleanTrack(source.track),geo,trips};
  }
  function current(){return {basic:read(keys.basic,{favorites:[],diary:[]}),points:read(keys.points,[]),track:read(keys.track,[]),geo:read(keys.geo,[]),trips:read(keys.trips,[])};}
  function mergeBackup(incoming) {
    const previous=current();
    const merge=(a,b,identify=x=>x.id)=>[...new Map([...array(b),...array(a)].filter(Boolean).map(x=>[identify(x),x])).values()];
    const trips=merge(previous.trips,incoming.trips);
    if(previous.track.length&&incoming.track.length&&JSON.stringify(previous.track)!==JSON.stringify(incoming.track)&&
       !trips.some(trip=>JSON.stringify(trip.track)===JSON.stringify(incoming.track))) {
      trips.push({id:crypto.randomUUID(),name:'Маршрут из резервной копии',date:dateToday(),notes:'',track:incoming.track});
    }
    return {
      basic:{favorites:[...new Set([...array(previous.basic.favorites),...incoming.basic.favorites])],diary:merge(previous.basic.diary,incoming.basic.diary).slice(-1000)},
      points:merge(previous.points,incoming.points).slice(-600),track:previous.track.length?previous.track:incoming.track,
      geo:merge(previous.geo,incoming.geo,x=>x.id||`${x.lat}/${x.lon}/${x.label}`).slice(-300),trips
    };
  }
  function commit(state) {
    window.MoOLVaProfile41.commit(Object.entries(keys).map(([name,key]) => [key,JSON.stringify(state[name])]));
  }
  function exportAll(){
    const data={app:'MoOLVa Грибы',schema:34,created:new Date().toISOString(),data:current()};
    const link=document.createElement('a');
    link.download=`MoOLVa-Griby-Backup-${dateToday()}.json`;
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    link.href=url;link.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
  }
  function mountBackup(){
    const dialog=document.createElement('dialog');dialog.className='p34-dialog';
    dialog.innerHTML='<h2>Резервная копия</h2><p>Дневник, избранное, личные точки, поездки и маршруты.</p><div class="exp-ops"><button type="button" class="primary" id="p34-export">Сохранить JSON</button><label class="exp-upload">Выбрать резерв<input id="p34-import" type="file" accept=".json,application/json" hidden></label><button type="button" class="exp-button" id="p34-close">Закрыть</button></div><p role="status" id="p34-summary"></p><button type="button" class="primary" id="p34-apply" hidden>Восстановить</button>';
    document.body.append(dialog);
    let incoming;
    $('p34-export').addEventListener('click',exportAll);
    $('p34-close').addEventListener('click',()=>dialog.close());
    $('p34-import').addEventListener('change',async e=>{
      const file=e.target.files[0];e.target.value='';incoming=null;$('p34-apply').hidden=true;
      if(!file)return;
      try{
        if(file.size>12_000_000)throw new Error('Выберите резервную копию размером до 12 МБ.');
        incoming=cleanBackup(JSON.parse(await file.text()));
        const before=current(),after=mergeBackup(incoming);
        $('p34-summary').textContent=`Будет добавлено: записи дневника — ${after.basic.diary.length-array(before.basic.diary).length}, избранное — ${after.basic.favorites.length-array(before.basic.favorites).length}, точки — ${after.points.length+after.geo.length-before.points.length-before.geo.length}, поездки — ${after.trips.length-before.trips.length}, узлы активного маршрута — ${after.track.length-before.track.length}.`;
        $('p34-apply').hidden=false;
      }catch(e){$('p34-summary').textContent=e.message;}
    });
    $('p34-apply').addEventListener('click',()=>{
      if(!incoming)return;
      try{commit(mergeBackup(incoming));window.location.reload();}
      catch{$('p34-summary').textContent='Не удалось записать резервную копию. Проверьте доступное место.';}
    });
    window.MoOLVaBackup34={show:()=>dialog.showModal()};
  }
  function mountTrips(){
    const expedition=window.MoOLVaExpedition30;
    const root=$('exp-private-status');
    if(!expedition||!root)return;
    const panel=document.createElement('div');panel.className='p34-trip-panel';
    panel.innerHTML='<div class="exp-ops"><button type="button" class="exp-button" id="p34-car">Машина в центре карты</button><button type="button" class="exp-button" id="p34-new-trip">Сохранить поездку</button></div><form id="p34-trip-form" class="exp-form" hidden><input id="p34-trip-name" required maxlength="100" placeholder="Название поездки"><textarea id="p34-trip-notes" maxlength="1000" rows="2" placeholder="Заметки"></textarea><button type="submit" class="primary">Добавить в дневник</button></form><p id="p34-trip-status" role="status"></p>';
    root.after(panel);
    const list=document.createElement('div');list.className='p34-trip-panel';list.id='p34-trips';
    $('diaryItems').after(list);
    function render(){
      const heading=document.createElement('h3');heading.textContent='Поездки';list.replaceChildren(heading);
      for(const trip of read(keys.trips,[]).slice().reverse()){
        const line=document.createElement('article');line.className='exp-private-row';
        const label=document.createElement('strong');label.textContent=`${trip.date} · ${trip.name}`;line.append(label);
        const notes=document.createElement('p');notes.textContent=trip.notes||`Точек на маршруте: ${trip.track.length}`;line.append(notes);
        if(trip.track.length>1){
          const button=document.createElement('button');button.type='button';button.className='exp-button';button.textContent='Показать трек';
          button.addEventListener('click',()=>{expedition.show();expedition.previewTrack(trip.track);});line.append(button);
        }
        list.append(line);
      }
      list.hidden=list.children.length===1;
    }
    $('p34-car').addEventListener('click',()=>{
      const center=window.MoOLVaFreeMap32?.getMap()?.getCenter();
      try{$('p34-trip-status').textContent=center&&expedition.markCar(center.lat,center.lng)?'Место машины сохранено в личных точках.':'Сместите центр карты к месту стоянки.';}
      catch{$('p34-trip-status').textContent='Не удалось сохранить точку.';}
    });
    $('p34-new-trip').addEventListener('click',()=>{$('p34-trip-form').hidden=!$('p34-trip-form').hidden;if(!$('p34-trip-form').hidden)$('p34-trip-name').focus();});
    $('p34-trip-form').addEventListener('submit',e=>{
      e.preventDefault();const name=$('p34-trip-name').value.trim();if(!name)return;
      try{
        const trips=read(keys.trips,[]);
        trips.push({id:crypto.randomUUID(),name,date:dateToday(),notes:$('p34-trip-notes').value.trim(),track:cleanTrack(expedition.getTrack())});
        window.MoOLVaProfile41.setItem(keys.trips,JSON.stringify(trips));
        e.target.reset();e.target.hidden=true;render();$('p34-trip-status').textContent='Поездка сохранена в дневнике.';
      }catch{$('p34-trip-status').textContent='Не удалось сохранить поездку. Проверьте доступное место.';}
    });
    render();
  }
  window.addEventListener('DOMContentLoaded',()=>{mountBackup();mountTrips();});
})();
