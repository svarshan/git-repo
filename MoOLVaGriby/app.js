'use strict';
(() => {
  const birds = Array.isArray(window.MOOLVA_MUSHROOMS) ? window.MOOLVA_MUSHROOMS : [];
  const photos = window.MOOLVA_PHOTOS && typeof window.MOOLVA_PHOTOS === 'object' ? window.MOOLVA_PHOTOS : {};
  const byId = new Map(birds.map(b=>[b.id,b])), byLatin=new Map(birds.map(b=>[b.latin,b]));
  const $ = s => document.querySelector(s);
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safePhoto=b=>{const x=photos[b.latin];return x&&/^media\/photos\/[A-Za-z0-9_-]+\.jpg$/.test(x.file)?x:null;};
  const latinTranslate = text => String(text).toLowerCase().replace(/[ё]/g,'е').replace(/[а-я]/g,c=>({'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ы':'y','э':'e','ю':'yu','я':'ya','ь':'','ъ':''}[c]||c)).normalize('NFKD').replace(/[\u0300-\u036f]/g,'');
  const months=['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
  const storeKey='moolva-griby-1.0-data';
  function load(){try{const data=JSON.parse(localStorage.getItem(storeKey)||'{}');return {
   favorites:new Set(Array.isArray(data.favorites)?data.favorites.filter(x=>byId.has(x)):[]),
   diary:Array.isArray(data.diary)?data.diary.filter(x=>x&&typeof x==='object'&&byId.has(x.speciesId)).slice(-1000):[]};}
   catch{return {favorites:new Set(),diary:[]};}}
  let state=load(),page='catalog',visible=18,query='',currentId=null;
  function save(){try{localStorage.setItem(storeKey,JSON.stringify({favorites:[...state.favorites],diary:state.diary}));return true;}catch{toast('Не удалось записать данные на диск');return false;}}
  function toast(text){const box=$('#toast');box.textContent=text;box.classList.add('visible');clearTimeout(toast.t);toast.t=setTimeout(()=>box.classList.remove('visible'),3200);}
  function stopSpeech(){if('speechSynthesis' in window)window.speechSynthesis.cancel();}
  function hazard(risk){return risk==='смертельно-ядовитый'||risk==='ядовитый';}
  function hazardLabel(b){return b.risk==='смертельно-ядовитый'?'☠ Смертельно ядовитый':hazard(b.risk)?'⚠ Ядовитый':'● Справочная карточка';}
  function mediaHTML(b,mode='tile'){
    const img=safePhoto(b);
    if(!img)return '<div class="photomissing"><span aria-hidden="true">🍄</span>Фото не проверено / отсутствует</div>';
    return '<img loading="'+(mode==='detail'?'eager':'lazy')+'" decoding="async" src="'+escapeHTML(img.file)+'" alt="Фотография: '+escapeHTML(b.name)+'">';
  }
  function card(b){
    return '<article class="mush-card"><button class="mush-image" data-open="'+escapeHTML(b.id)+'">'+mediaHTML(b)+(hazard(b.risk)?'<span class="hazard '+(b.risk==='смертельно-ядовитый'?'deadly':'')+'">'+escapeHTML(hazardLabel(b))+'</span>':'')+'</button>'+
    '<div class="card-body"><h3>'+escapeHTML(b.name)+'</h3><div class="latin">'+escapeHTML(b.latin)+'</div><div class="card-meta"><span class="chip">'+escapeHTML(b.group)+'</span><span class="chip">'+escapeHTML(b.months[0])+'–'+escapeHTML(b.months[b.months.length-1])+' мес.</span></div><p>'+escapeHTML(b.traits)+'</p></div>'+
    '<div class="card-foot"><button data-open="'+escapeHTML(b.id)+'">Открыть паспорт →</button><button class="fav '+(state.favorites.has(b.id)?'isfav':'')+'" title="Избранное" aria-label="Избранное" data-fav="'+escapeHTML(b.id)+'">'+(state.favorites.has(b.id)?'♥':'♡')+'</button></div></article>';
  }
  function filt(){
    const group=$('#group').value,risk=$('#risk').value,month=Number($('#season').value);
    const q=latinTranslate($('#search').value.trim());
    return birds.filter(b=>{
      if(group&&b.group!==group)return false;
      if(risk==='danger'&&!hazard(b.risk))return false;
      if(risk==='reference'&&hazard(b.risk))return false;
      if(month&&!b.months.includes(month))return false;
      const searchable=latinTranslate([b.name,b.latin,b.group,b.traits,b.habitat].join(' '));
      return !q||q.split(/\s+/).every(t=>searchable.includes(t));
    }).sort((a,b)=>a.name.localeCompare(b.name,'ru'));
  }
  function renderCatalog(){const list=filt();$('#cards').innerHTML=list.slice(0,visible).map(card).join('')||'<div class="empty">По вашему запросу ничего не найдено.</div>';
    $('#resultCount').textContent=list.length+' из '+birds.length+' видов';
    $('#showMore').hidden=visible>=list.length;}
  function renderFav(){const list=birds.filter(b=>state.favorites.has(b.id));$('#favCards').innerHTML=list.length?list.map(card).join(''):'<div class="empty">Вы пока не добавили грибы в избранное. Нажмите ♡ в карточке вида.</div>';}
  function renderStats(){const imgs=birds.filter(b=>safePhoto(b)).length;$('#statTotal').textContent=birds.length;$('#statHazard').textContent=birds.filter(b=>hazard(b.risk)).length;$('#statImages').textContent=imgs+'/'+birds.length;$('#statDiary').textContent=state.diary.length;$('#counter').textContent=birds.length+' видов';}
  const headings={catalog:['Грибной атлас','Изучайте виды и опасные двойники, сохраняйте наблюдения'],
   compare:['Сравнение грибов','Изучайте отличия похожих видов'],diary:['Дневник грибника','Ваши собственные наблюдения, сохранённые локально'],
   map:['Мои места','Личные находки без выдуманных географических точек'],favorites:['Избранное','Сохранённые виды из энциклопедии'],
   quality:['Фото и источники','Авторы, лицензии, прозрачность данных'],about:['О приложении','Офлайн-атлас MoOLVa Грибы 1.0 PRO MAX']};
  function nav(next){if(!headings[next])return;stopSpeech();closeDetail();page=next;
    document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id===page));
    document.querySelectorAll('[data-page]').forEach(x=>x.classList.toggle('selected',x.dataset.page===page));
    $('#heading').textContent=headings[page][0];$('#subtitle').textContent=headings[page][1];
    if(page==='catalog')renderCatalog();if(page==='favorites')renderFav();if(page==='compare')renderCompare();
    if(page==='diary')renderDiary();if(page==='map')renderMap();if(page==='quality')renderQuality();
    window.scrollTo(0,0);}
  function sourceLink(b){const img=safePhoto(b);if(!img)return '<p class="photo-credit">Подтверждённая фотография не загружена. Имитировать её не будем.</p>';
    const link=/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(img.source)?'<a href="'+escapeHTML(img.source)+'" target="_blank" rel="noopener noreferrer">Открыть оригинал на Wikimedia Commons ↗</a>':'';
    return '<p class="photo-credit">Фото: '+escapeHTML(img.author||'автор указан в первоисточнике')+' · '+escapeHTML(img.license||'условия не указаны')+'. Категория по метаданным; визуальная идентификация вида не подтверждена. '+link+'</p>';}
  function closeDetail(){if(currentId===null)return;stopSpeech();$('#overlay').hidden=true;document.body.style.overflow='';currentId=null;}
  function openDetail(id){
    const b=byId.get(id);if(!b)return;closeDetail();currentId=id;
    const similar=byLatin.get(b.similar),period=b.months.map(m=>months[m-1]).join(', ');
    const dangerous=hazard(b.risk),riskText=dangerous?'<div class="red-warning"><b>'+escapeHTML(hazardLabel(b))+'</b> — не собирайте для употребления. Некоторые токсины вызывают отсроченные симптомы.</div>':'<div class="note">Справочный статус не означает, что найденный вами гриб безопасен для употребления. Возможны похожие ядовитые виды.</div>';
    $('#detail').innerHTML='<div class="detail-header"><span class="eyebrow">ПАСПОРТ ВИДА · ГРИБНОЙ АТЛАС</span><h2>'+escapeHTML(b.name)+'</h2><div class="latin">'+escapeHTML(b.latin)+'</div></div><div class="detail-photo">'+mediaHTML(b,'detail')+'</div>'+
      '<div class="detail-content"><div class="detail-pills"><span class="chip">'+escapeHTML(b.group)+'</span><span class="chip">'+escapeHTML(hazardLabel(b))+'</span></div>'+
      riskText+'<h3>Внешние признаки</h3><p>'+escapeHTML(b.traits)+'</p><h3>Местообитание</h3><p>'+escapeHTML(b.habitat)+'. <b>Наличие этого вида в конкретной точке Нижегородской области не подтверждено.</b></p>'+
      '<h3>Ориентировочный сезон</h3><p>'+escapeHTML(period)+'. Сроки зависят от погоды и природной зоны, не являются прогнозом.</p>'+
      '<h3>Похожие виды и двойники</h3><p>'+(similar?escapeHTML(similar.name)+' — '+escapeHTML(similar.latin):escapeHTML(b.similar||'Требуется сравнение у специалиста'))+'. По отдельному внешнему признаку определять гриб нельзя.</p>'+
      '<h3>Фотография и первоисточник</h3>'+sourceLink(b)+'<p class="photo-credit">Таксономию и статус сверяйте с научными справочниками и региональными гербарными данными. '+(b.regionVerified?'Есть региональное подтверждение':'Региональное присутствие не аттестовано в версии 1.0')+'.</p>'+
      '<div class="detail-actions"><button class="primary" data-fav="'+escapeHTML(b.id)+'">'+(state.favorites.has(b.id)?'♥ В избранном':'♡ В избранное')+'</button>'+
      (similar?'<button data-compare="'+escapeHTML(b.id)+'">⇄ Сравнить с двойником</button>':'')+
      '<button data-speak="'+escapeHTML(b.id)+'">▷ Озвучить описание</button><button data-stop>■ Стоп</button><button data-observe="'+escapeHTML(b.id)+'">＋ Записать находку</button></div></div>';
    $('#overlay').hidden=false;document.body.style.overflow='hidden';$('.modal').scrollTop=0;}
  function speak(id){const b=byId.get(id);if(!b)return;if(!('speechSynthesis'in window)){toast('Системная озвучка недоступна');return;}stopSpeech();
    const utt=new SpeechSynthesisUtterance(b.name+'. '+b.traits+'. '+b.habitat+'. Помните: по фотографии и описанию нельзя подтверждать безопасность гриба.');utt.lang='ru-RU';utt.rate=.93;
    const ru=window.speechSynthesis.getVoices().find(v=>v.lang.toLowerCase().startsWith('ru'));if(ru)utt.voice=ru;window.speechSynthesis.speak(utt);}
  function fav(id){if(!byId.has(id))return;state.favorites.has(id)?state.favorites.delete(id):state.favorites.add(id);save();
    renderCatalog();renderFav();if(currentId)openDetail(currentId);toast('Избранное обновлено');}
  function renderCompare(){const a=byId.get($('#pickA').value)||birds[0],b=byId.get($('#pickB').value)||birds[1];if(!a||!b)return;
    const panel=x=>'<div class="compare-panel">'+mediaHTML(x)+'<div class="body"><h3>'+escapeHTML(x.name)+'</h3><div class="latin">'+escapeHTML(x.latin)+'</div>'+ (hazard(x.risk)?'<div class="red-warning">'+escapeHTML(hazardLabel(x))+'</div>':'')+
      '<dl><dt>Группа</dt><dd>'+escapeHTML(x.group)+'</dd><dt>Признаки</dt><dd>'+escapeHTML(x.traits)+'</dd><dt>Местообитание</dt><dd>'+escapeHTML(x.habitat)+'</dd><dt>Сезон (месяцы)</dt><dd>'+x.months.join(', ')+'</dd><dt>Статус</dt><dd>'+escapeHTML(hazardLabel(x))+'; не рекомендация к употреблению</dd></dl><button class="ghost" data-open="'+escapeHTML(x.id)+'">Подробнее →</button></div></div>';
    $('#comparison').innerHTML=panel(a)+panel(b);}
  function exportData(){const json={app:'MoOLVa Грибы',schema:1,created:new Date().toISOString(),favorites:[...state.favorites],diary:state.diary};download('MoOLVa-Griby-Backup.json',JSON.stringify(json,null,2),'application/json');toast('Резервная копия сохранена в JSON');}
  function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}
  function renderDiary(){const items=state.diary.slice().reverse();$('#diaryItems').innerHTML=items.length?items.map(entry=>{
    const b=byId.get(entry.speciesId);return '<article class="diaryrow"><div><h3>'+escapeHTML(b?.name||'Неизвестный вид')+'</h3><p>'+escapeHTML(entry.date)+' · '+escapeHTML(entry.place)+'</p><p>'+escapeHTML(entry.notes||'Нет заметок')+'</p><small class="muted">Определение предварительное · личная запись</small></div><button data-delete="'+escapeHTML(entry.id)+'">Удалить</button></article>';
  }).join(''):'<div class="empty">В дневнике пока нет записей. Добавьте первую находку выше.</div>';}
  function renderMap(){const entries=state.diary.slice().reverse();$('#mapItems').innerHTML=entries.length?entries.map(x=>'<div class="place"><div><h3>⌖ '+escapeHTML(x.place)+'</h3><p>'+escapeHTML(x.date)+' · '+escapeHTML(byId.get(x.speciesId)?.name||'Гриб')+'</p></div><span class="chip">Моё наблюдение</span></div>').join(''):'<div class="empty">Географических точек пока нет. Добавьте место в дневник — здесь появится его название.</div>';}
  function renderQuality(){const list=birds.map(b=>({b,p:safePhoto(b)}));const present=list.filter(x=>x.p).length;$('#qualityStats').innerHTML='<div><span>Всего видов</span><strong>'+birds.length+'</strong><small>учебные карточки</small></div><div><span>Файлов фотографий</span><strong>'+present+'</strong><small>из Wikimedia Commons</small></div><div><span>Без фото</span><strong>'+(birds.length-present)+'</strong><small>не подменяются</small></div><div><span>Экспертно подтверждено</span><strong>0</strong><small>визуальный аудит ещё требуется</small></div>';
    $('#qualityItems').innerHTML=list.map(x=>'<div class="qualityrow"><div><b>'+escapeHTML(x.b.name)+'</b> <span>· '+escapeHTML(x.b.latin)+'</span></div><span>'+(x.p?'Файл есть · нужен визуальный аудит':'Нет лицензированного фото')+'</span><button data-open="'+escapeHTML(x.b.id)+'">Паспорт</button></div>').join('');}
  function handleClick(e){const t=e.target.closest('button,[data-close]');if(!t)return;
    if(t.dataset.page){nav(t.dataset.page);return;}
    if(t.dataset.goto){nav(t.dataset.goto);return;}
    if(t.hasAttribute('data-close')){closeDetail();return;}
    if(t.dataset.open){openDetail(t.dataset.open);return;}
    if(t.dataset.fav){fav(t.dataset.fav);return;}
    if(t.dataset.compare){const b=byId.get(t.dataset.compare),similar=byLatin.get(b?.similar);if(!b||!similar)return;$('#pickA').value=b.id;$('#pickB').value=similar.id;nav('compare');return;}
    if(t.dataset.speak){speak(t.dataset.speak);return;}
    if(t.hasAttribute('data-stop')){stopSpeech();return;}
    if(t.dataset.observe){$('#obsSpecies').value=t.dataset.observe;nav('diary');$('#obsPlace').focus();return;}
    if(t.dataset.delete){if(!confirm('Удалить эту запись из дневника?'))return;state.diary=state.diary.filter(x=>x.id!==t.dataset.delete);save();renderDiary();renderMap();renderStats();return;}}
  function init(){
    const groups=[...new Set(birds.map(b=>b.group))].sort((a,b)=>a.localeCompare(b,'ru'));
    for(const x of groups){const o=document.createElement('option');o.value=o.textContent=x;$('#group').append(o);}
    for(const b of birds.slice().sort((a,b)=>a.name.localeCompare(b.name,'ru'))){for(const id of ['pickA','pickB','obsSpecies']){const option=document.createElement('option');option.value=b.id;option.textContent=b.name+' — '+b.latin;document.getElementById(id).append(option);}}
    $('#pickA').value=byLatin.get('Amanita phalloides')?.id||birds[0]?.id||'';
    $('#pickB').value=byLatin.get('Russula aeruginea')?.id||birds[1]?.id||'';
    $('#obsDate').value=new Date().toLocaleDateString('en-CA');
    document.addEventListener('click',handleClick);
    for(const id of ['search','group','risk','season'])document.getElementById(id).addEventListener(id==='search'?'input':'change',()=>{visible=18;renderCatalog();});
    $('#showMore').addEventListener('click',()=>{visible+=18;renderCatalog();});
    for(const id of ['pickA','pickB'])document.getElementById(id).addEventListener('change',renderCompare);
    $('#heroSearch').addEventListener('click',()=>{$('#search').focus();$('#search').scrollIntoView({behavior:'smooth',block:'center'});});
    $('#backupBtn').addEventListener('click',exportData);$('#exportDiary').addEventListener('click',exportData);
    $('#resetAll').addEventListener('click',()=>{if(!confirm('Точно удалить все ваши записи и избранное?'))return;state={favorites:new Set(),diary:[]};save();renderStats();renderDiary();toast('Личные записи очищены');});
    $('#diaryForm').addEventListener('submit',e=>{e.preventDefault();const speciesId=$('#obsSpecies').value,place=$('#obsPlace').value.trim(),date=$('#obsDate').value,notes=$('#obsNote').value.trim();
      if(!byId.has(speciesId)||!place||!date)return;
      state.diary.push({id:(typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():String(Date.now())+'-'+Math.random().toString(36).slice(2)),speciesId,place:place.slice(0,100),date,notes:notes.slice(0,1000)});
      if(!save()){state.diary.pop();return;}$('#obsPlace').value='';$('#obsNote').value='';renderDiary();renderStats();toast('Наблюдение сохранено только на этом устройстве');});
    window.addEventListener('keydown',e=>{if(e.key==='Escape')closeDetail();if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();nav('catalog');$('#search').focus();}});
    window.addEventListener('pagehide',stopSpeech);
    renderStats();renderCatalog();renderCompare();renderDiary();renderMap();
  }
  if(birds.length) init();
})();