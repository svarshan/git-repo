'use strict';
/* MoOLVa Griby 2.0: additive field tools. All tentative identifications remain unsafe for consumption. */
(function(){
  const core=window.MoOLVa20Core,base=window.MOOLVA_MUSHROOMS||[];
  if(!core||!base.length||!document.querySelector('.sidebar nav'))return;
  const $=id=>document.getElementById(id),html=txt=>String(txt??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  const byLatin=new Map(base.map(b=>[b.latin,b])),byId=new Map(base.map(b=>[b.id,b]));
  const reviewKey='moolva-griby-v2-photo-review',geoKey='moolva-griby-v2-my-coordinates',oldKey='moolva-griby-1.0-data';
  const region=core.cleanObservations(window.MOOLVA_REGION_OBS20||[]),gallery=window.MOOLVA_GALLERY20||{},photos=window.MOOLVA_PHOTOS||{};
  const note='Сходство изображений и результаты определения по признакам не подтверждают вид и не означают, что гриб можно употреблять в пищу.';
  const chapters=[
   {id:'field20',title:'Полевой режим',icon:'◉',caption:'Крупные элементы для работы в лесу'},
   {id:'id20',title:'Определитель',icon:'⌕',caption:'Варианты по наблюдаемым признакам — не экспертиза'},
   {id:'photo20',title:'Помощник по фото',icon:'▧',caption:'Сравнение окраски снимков, не AI-определение'},
   {id:'calendar20',title:'Календарь',icon:'▦',caption:'Сезоны и опубликованные наблюдения'},
   {id:'geo20',title:'Карта области',icon:'⌖',caption:'Опубликованные наблюдения сообщества и ваши координаты'},
   {id:'stats20',title:'Моя статистика',icon:'▥',caption:'Ваши наблюдения по годам и видам'},
   {id:'anatomy20',title:'Строение гриба',icon:'◎',caption:'Наглядная интерактивная схема'},
   {id:'protected20',title:'Охраняемые виды',icon:'♣',caption:'Охранный статус требует официальной проверки'}];
  const pageData={
   field20:'<div class="p20-hero"><h2>Лесной экран</h2><p>Увеличенные кнопки, быстрый поиск, сезон и офлайн-справочник. Для безопасности изучайте грибы, не делая вывод о пригодности к употреблению.</p><div class="p20-tools"><button class="p20-action" data-mode20>◉ Включить крупный интерфейс</button><button class="p20-action" data-goto20="id20">⌕ Определитель</button><button class="p20-action" data-goto20="photo20">▧ Фото-помощник</button><button class="p20-action" data-goto20="geo20">⌖ Места</button></div></div><div id="p20-field-status" class="p20-message"></div>',
   id20:'<div class="p20-note">'+note+'</div><div class="p20-grid3"><label>Тип нижней поверхности<select id="p20-group"><option value="">Не знаю</option><option value="Трубчатые">Трубочки</option><option value="Пластинчатые">Пластинки</option><option value="Складчатые">Складки / жилки</option><option value="Шиповатые">Шипики</option><option value="Древесные">Растёт на древесине</option></select></label><label>Описание шляпки<input id="p20-cap" placeholder="Например, коричневая" maxlength="40"></label><label>Место находки<input id="p20-habitat" placeholder="Например, берёза" maxlength="40"></label></div><div class="p20-tools"><button class="p20-action" id="p20-find">Показать возможные виды</button><button class="p20-muted" id="p20-clear">Очистить</button></div><div id="p20-id-results" class="p20-results"></div>',
   photo20:'<div class="p20-note">'+note+' Функция версии 2.0 сравнивает общую цветовую палитру фотографий, а не использует обученную модель распознавания грибов. Не доверяйте похожей окраске при определении.</div><div class="p20-upload"><button class="p20-action" type="button" id="p20-pick-files">Выбрать фотографии</button><input type="file" id="p20-upload" accept="image/jpeg,image/png,image/webp" multiple hidden><p>Выберите до трёх изображений. Снимки остаются в приложении и никуда не загружаются.</p></div><div id="p20-preview" class="p20-upload-preview"></div><div class="p20-tools"><button class="p20-action" id="p20-analyse">Найти внешне похожие фото</button><button class="p20-muted" id="p20-photo-clear">Очистить изображения</button></div><div id="p20-photo-results" class="p20-results"></div>',
   calendar20:'<div class="p20-note">Месяцы на карточках — ориентировочная сезонность. Гистограмма по iNaturalist содержит только выборку опубликованных наблюдений, не прогноз урожая.</div><div id="p20-season" class="p20-months"></div><div id="p20-season-chart" class="p20-bars"></div><div id="p20-season-caption" class="p20-message"></div>',
   geo20:'<div class="p20-note">Географическая схема: широта и долгота. Точки публикуются участниками iNaturalist, не являются маршрутами к грибным местам. Скрытые и неточные координаты не показываются.</div><div class="p20-geo-layout"><div><div id="p20-map" class="p20-map"></div><div id="p20-map-note" class="p20-message"></div></div><div class="p20-geo-side"><label>Вид<select id="p20-map-species"><option value="">Все виды</option></select></label><label>Источник<select id="p20-map-source"><option value="all">Все точки</option><option value="published">Опубликованные</option><option value="personal">Мои</option></select></label><div id="p20-map-selection" class="p20-message">Нажмите на точку, чтобы увидеть её источник.</div><h3>Добавить личную геометку</h3><form id="p20-location-form"><label>Название места<input id="p20-loc-label" required maxlength="80" placeholder="Мой лес"></label><label>Широта<input type="number" id="p20-lat" min="54.1" max="58.2" step="0.000001" required placeholder="56.3"></label><label>Долгота<input type="number" id="p20-lon" min="41.2" max="48.2" step="0.000001" required placeholder="44.0"></label><button class="p20-action" type="submit">Сохранить только на моём ПК</button></form><button class="p20-muted" id="p20-export-geo">Экспорт личных точек</button></div></div>',
   stats20:'<div class="p20-note">Статистика строится только по вашему дневнику версии 1.0, сохранённому на этом компьютере. Сведения не отправляются в сеть.</div><div id="p20-my-stats" class="p20-stat-panels"></div><div class="p20-tools"><button class="p20-action" id="p20-csv">Экспорт дневника CSV для Excel</button><button class="p20-muted" id="p20-restore">Восстановить JSON резервной копии</button><button class="p20-muted" id="p20-print">Печать / PDF</button><input id="p20-restore-file" type="file" accept=".json,application/json" hidden></div>',
   anatomy20:'<div class="p20-note">Условная схема шляпочного пластинчатого гриба. У трубчатых и других групп строение отличается; нельзя определять вид только по одной детали.</div><div class="p20-anatomy-layout"><svg viewBox="0 0 440 460" role="img" aria-label="Схема шляпочного гриба"><defs><linearGradient id="m20cap" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ce9c63"/><stop offset="1" stop-color="#814a2f"/></linearGradient></defs><path d="M80 206 C92 58 350 58 365 206 Q228 248 80 206Z" fill="url(#m20cap)" stroke="#ddbd8e" stroke-width="5"/><path d="M94 211 Q221 276 352 211" stroke="#f1d8a5" stroke-width="25" fill="none"/><path d="M197 250 Q217 246 239 250 L253 417 L185 417Z" fill="#d3bd92" stroke="#f3dab0" stroke-width="4"/><path d="M185 300 Q223 333 256 303" fill="none" stroke="#f7e7cb" stroke-width="12"/><path d="M177 415 Q222 440 265 415" stroke="#d0ba91" stroke-width="15"/><circle cx="135" cy="110" r="9" fill="#eed3a0"/><circle cx="313" cy="147" r="11" fill="#eed3a0"/><g fill="#eff6dd" font-family="sans-serif" font-size="18"><text x="18" y="55">Шляпка</text><text x="284" y="282">Пластинки</text><text x="5" y="318">Кольцо</text><text x="290" y="388">Ножка</text></g><g stroke="#e9c084" stroke-width="2" fill="none"><path d="M92 61L132 116"/><path d="M283 268L318 223"/><path d="M80 309L197 306"/><path d="M280 382L243 367"/></g></svg><div><div class="p20-tools"><button class="p20-part" data-part="cap">Шляпка</button><button class="p20-part" data-part="gills">Пластинки</button><button class="p20-part" data-part="pores">Трубочки</button><button class="p20-part" data-part="ring">Кольцо</button><button class="p20-part" data-part="volva">Вольва</button><button class="p20-part" data-part="stem">Ножка</button></div><div id="p20-part-desc" class="p20-message">Нажмите на часть гриба.</div></div></div>',
   protected20:'<div class="p20-note">Без сверки с актуальной Красной книгой Нижегородской области нельзя утверждать, что вид охраняется или не охраняется. Ни один статус здесь не присваивается автоматически.</div><div id="p20-protected-list" class="p20-results"></div><div class="p20-message">Раздел предусматривает проверку официальных региональных данных и обновление охранных статусов в будущей редакции каталога. Пока показаны только кандидаты для проверки, а не действующий перечень охраняемых видов.</div>'};
  const nav=document.querySelector('.sidebar nav'),main=document.querySelector('main');
  const heading=txt=>'<div class="sectiontop"><div><span class="eyebrow">MoOLVa ГРИБЫ · PRO MAX 2.0</span><h2>'+html(txt)+'</h2></div></div>';
  for(const chapter of chapters){
    const button=document.createElement('button');button.type='button';button.dataset.stage20=chapter.id;
    button.innerHTML='<span>'+chapter.icon+'</span> '+html(chapter.title);nav.append(button);
    const section=document.createElement('section');section.className='page p20-page';section.id=chapter.id;
    section.innerHTML=heading(chapter.title)+pageData[chapter.id];main.append(section);
  }
  const version=document.createElement('div');version.className='p20-version';
  version.innerHTML='<b>MoOLVa Грибы 2.0</b><span>Региональные данные: '+html((window.MOOLVA_REGION_META20||{}).status||'не получены')+'</span>';
  document.querySelector('.sidebar').append(version);
  function show(id){if(!chapters.some(x=>x.id===id))return;
    window.speechSynthesis?.cancel?.();
    document.querySelectorAll('section.page').forEach(x=>x.classList.toggle('active',x.id===id));
    document.querySelectorAll('.sidebar button').forEach(x=>x.classList.toggle('selected',x.dataset.stage20===id));
    document.querySelector('#heading').textContent=chapters.find(x=>x.id===id).title;
    document.querySelector('#subtitle').textContent=chapters.find(x=>x.id===id).caption;
    if(id==='calendar20')renderCalendar();
    if(id==='geo20')renderMap();
    if(id==='stats20')renderStats();
    if(id==='protected20')renderProtected();
    window.scrollTo(0,0);
  }
  const goButtons=document.querySelectorAll('.topmeta');
  if(goButtons.length){const commands=document.createElement('div');commands.className='p20-top-links';
    commands.innerHTML='<button data-goto20="id20">⌕ Определить признаки</button><button data-goto20="photo20">▧ Фото-помощник</button><button data-goto20="geo20">⌖ Карта</button><button data-goto20="field20">◉ В лесу</button>';
    goButtons[0].append(commands);}
  const aboutSection=document.querySelector('#about .aboutbox');
  if(aboutSection){const updates=document.createElement('section');updates.className='p20-qa';
    updates.innerHTML='<h3>Обновления MoOLVa</h3><p>Проверка запускается только по кнопке и обращается к публичному GitHub Releases. Файлы автоматически не устанавливаются.</p><button class="p20-action" id="p20-update-check">Проверить новую версию</button><div id="p20-update-status" class="p20-message">Текущая версия 2.0.0</div>';
    aboutSection.append(updates);}
  const photoReview=()=>{try{return JSON.parse(localStorage.getItem(reviewKey)||'{}')}catch{return {}}};
  const personalGeo=()=>{try{const x=JSON.parse(localStorage.getItem(geoKey)||'[]');return Array.isArray(x)?x.filter(o=>Number.isFinite(o.lat)&&Number.isFinite(o.lon)).slice(-300):[]}catch{return []}};
  const oldData=()=>{try{return JSON.parse(localStorage.getItem(oldKey)||'{}')}catch{return {}}};
  function toast(msg){const el=$('toast');if(el){el.textContent=msg;el.classList.add('visible');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('visible'),2400);}}
  function download(name,data,type){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
  const monthNames=['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
  function renderCalendar(){
    const counts=core.seasonCounts(region),max=Math.max(1,...counts);
    const host=$('p20-season'),bars=$('p20-season-chart');
    host.innerHTML=monthNames.map((name,i)=>'<button data-month20="'+(i+1)+'">'+html(name)+'</button>').join('');
    bars.innerHTML=counts.map((v,i)=>'<div><span>'+monthNames[i]+'</span><div class="p20-bar"><i style="height:'+(v/max*100)+'%"></i></div><strong>'+v+'</strong></div>').join('');
    $('p20-season-caption').textContent='Выборка опубликованных наблюдений: '+region.length+' записей. Отсутствие наблюдений в месяце не означает отсутствия грибов.';
  }
  function drawMap(){
    const type=$('p20-map-source').value,latin=$('p20-map-species').value;
    const published=(type==='personal'?[]:region).filter(x=>!latin||x.latin===latin);
    const own=type==='published'?[]:personalGeo();
    const dots=published.map(x=>({...x,kind:'published'})).concat(own.map(x=>({...x,id:x.id,latin:x.latin||'',kind:'personal'})));
    const svg='<svg viewBox="0 0 850 610" role="img" aria-label="Расположение наблюдений на координатной схеме Нижегородской области">'+
     '<rect width="850" height="610" fill="#112d27"/>'+
     Array.from({length:9},(_,i)=>'<line x1="'+(i*106)+'" y1="0" x2="'+(i*106)+'" y2="610" stroke="#2b5246" stroke-width="1"/>').join('')+
     Array.from({length:7},(_,i)=>'<line x1="0" y1="'+(i*101)+'" x2="850" y2="'+(i*101)+'" stroke="#2b5246" stroke-width="1"/>').join('')+
     '<text x="18" y="35" fill="#b4d9c4" font-size="18">Nizhny Novgorod Oblast · координатная схема</text>'+
     dots.slice(0,300).map((o,i)=>{const v=core.project(o),cx=(v.x/100*850).toFixed(1),cy=(v.y/100*610).toFixed(1);
       return '<circle data-point20="'+i+'" cx="'+cx+'" cy="'+cy+'" r="'+(o.kind==='personal'?'9':'5')+'" tabindex="0" role="button" aria-label="Наблюдение" fill="'+(o.kind==='personal'?'#f3b36f':'#80bb92')+'" stroke="#10261a" stroke-width="2"/>';}).join('')+
     '<text x="22" y="586" fill="#b4d9c4" font-size="16">41.2°–48.2° E · 54.1°–58.2° N</text></svg>';
    $('p20-map').innerHTML=svg;
    $('p20-map-note').textContent='Показано '+published.length+' опубликованных наблюдений и '+own.length+' личных геометок. Схема без дорожного/топографического слоя.';
    $('p20-map')._dots=dots;
  }
  function renderMap(){
    if(!$('p20-map-species').options.length||$('p20-map-species').options.length===1){
      const names=new Set(region.map(x=>x.latin));for(const latin of [...names].sort()){const op=document.createElement('option');op.value=latin;op.textContent=byLatin.get(latin)?.name||latin;$('p20-map-species').append(op);}
    }
    drawMap();
  }
  function handlePoint(index){const o=$('p20-map')._dots?.[index];if(!o)return;
    const name=byLatin.get(o.latin)?.name||o.latin||'Личная точка';
    $('p20-map-selection').innerHTML='<b>'+html(name)+'</b><p>Широта '+Number(o.lat).toFixed(4)+' · долгота '+Number(o.lon).toFixed(4)+'</p>'+
     (o.kind==='published'?'<p>Дата: '+html(o.date||'нет даты')+' · iNaturalist, исследовательская оценка сообщества</p><a target="_blank" rel="noopener noreferrer" href="'+html(o.source)+'">Исходное наблюдение ↗</a>':'<p>Только локальная геометка: '+html(o.label||'')+'</p>');}
  function renderStats(){
    const data=oldData(),notes=Array.isArray(data.diary)?data.diary:[],year=core.yearCounts(notes);
    const favorites=Array.isArray(data.favorites)?data.favorites.length:0;
    const species=new Set(notes.map(x=>x.speciesId));
    $('p20-my-stats').innerHTML='<div class="p20-stat"><strong>'+notes.length+'</strong><span>Наблюдений</span></div><div class="p20-stat"><strong>'+species.size+'</strong><span>Разных названий</span></div><div class="p20-stat"><strong>'+favorites+'</strong><span>Избранных видов</span></div>'+
    '<div class="p20-stat p20-wide"><b>По годам</b><ul>'+year.map(([y,v])=>'<li>'+html(y)+': '+v+'</li>').join('')+'</ul></div>';
  }
  function renderProtected(){
    $('p20-protected-list').innerHTML=base.filter(b=>b.regionVerified).slice(0,20).map(b=>'<p>'+html(b.name)+' — историческая запись, охранный статус не проверен</p>').join('')||'<div class="p20-message">Ни один вид пока не получил официально проверенного охранного статуса. Данные будут добавлены после сверки с действующим изданием Красной книги Нижегородской области.</div>';
  }
  const anatomy={
    cap:'Шляпка: окраска и форма меняются с возрастом, влажностью и освещением. Не служит единственным критерием.',
    gills:'Пластинки: изучают их прикрепление, цвет и частоту. Не путайте с нисходящими складками лисичек.',
    pores:'Трубочки и поры: видны снизу у многих болетовых. Не все трубчатые виды пригодны в пищу.',
    ring:'Кольцо: остаток частного покрывала, может исчезать у старых грибов. Его отсутствие ничего не доказывает.',
    volva:'Вольва: общий покров у основания ножки некоторых мухоморов. Основание важно видеть целиком; не вырывайте грибы ради проверки через приложение.',
    stem:'Ножка: сетка, чешуйки, цвет, полость и место крепления помогают описанию, но недостаточны для решения о съедобности.'
  };
  function keyResults(){
    const group=$('p20-group').value,cap=$('p20-cap').value.trim(),habitat=$('p20-habitat').value.trim();
    if(!group&&!cap&&!habitat){$('p20-id-results').innerHTML='<div class="p20-message">Укажите хотя бы один признак. Если признак неизвестен, не угадывайте.</div>';return;}
    const results=core.candidates(base,{fields:{group,cap,substrate:habitat}});$('p20-id-results').innerHTML=results.length?
      results.map(x=>'<article class="p20-hit"><b>'+html(x.bird.name)+'</b><i>'+html(x.bird.latin)+'</i><p>'+html(x.bird.traits)+'</p><span>Только предположительное совпадение по тексту. '+html(core.explainRisk(x.bird))+'</span><button data-open="'+html(x.bird.id)+'">Паспорт</button></article>').join(''):
      '<div class="p20-message">Ни одно описание не совпало. Не делайте вывод, что вид безопасен или отсутствует в регионе.</div>';
  }
  let uploadURLs=[],selectedFiles=[];
  function cleanUploads(){for(const url of uploadURLs)URL.revokeObjectURL(url);uploadURLs=[];selectedFiles=[];$('p20-preview').replaceChildren();$('p20-upload').value='';}
  function imageHistogram(img){
    const cv=document.createElement('canvas');cv.width=64;cv.height=64;
    const ctx=cv.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,64,64);
    const pixels=ctx.getImageData(0,0,64,64).data,counts=Array(24).fill(0);
    for(let i=0;i<pixels.length;i+=4){if(pixels[i+3]<100)continue;for(let ch=0;ch<3;ch++)counts[ch*8+Math.min(7,Math.floor(pixels[i+ch]/32))]++;}
    const s=counts.reduce((a,b)=>a+b,0)||1;return counts.map(v=>v/s);
  }
  function imageReady(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Изображение недоступно'));img.src=src;});}
  async function photoCompare(){
    if(!selectedFiles.length){$('p20-photo-results').innerHTML='<div class="p20-message">Выберите один или несколько снимков.</div>';return;}
    const host=$('p20-photo-results');host.textContent='Сравнение локальных изображений…';
    try{
      const images=await Promise.all(uploadURLs.map(imageReady)),input=imageHistogram(images[0]);
      const existing=base.filter(b=>core.eligiblePhoto(photos[b.latin])).slice(0,80),comparisons=[];
      for(const b of existing){
        try{const image=await imageReady(photos[b.latin].file);comparisons.push({b,score:core.scoreColors(input,imageHistogram(image))});}
        catch{}
      }
      comparisons.sort((a,b)=>b.score-a.score);
      host.innerHTML='<div class="p20-note">Это сходство распределения цветов, а не уверенность в виде. Красные, коричневые и белые грибы разных видов могут выглядеть почти одинаково. Не используйте результат для употребления в пищу.</div>'+
        comparisons.slice(0,8).map(x=>'<article class="p20-hit"><img loading="lazy" src="'+html(photos[x.b.latin].file)+'" alt="'+html(x.b.name)+'"><div><b>'+html(x.b.name)+'</b><i>'+html(x.b.latin)+'</i><p>Схожая цветовая палитра; не идентификация.</p><button data-open="'+html(x.b.id)+'">Открыть вид</button></div></article>').join('');
      if(!comparisons.length)host.innerHTML='<div class="p20-message">Не получилось найти доступные для локального сравнения фотографии.</div>';
    }catch(e){host.textContent='Не удалось обработать фотографию: '+String(e.message||e).slice(0,120);}
  }
  function integrateDetail(){
    const detail=$('detail');if(!detail||!detail.children.length||detail.querySelector('#p20-detail-gallery'))return;
    const latin=detail.querySelector('.latin')?.textContent?.trim(),b=byLatin.get(latin);if(!b)return;
    const entries=[photos[b.latin],...(Array.isArray(gallery[b.latin])?gallery[b.latin]:[])].filter(core.eligiblePhoto);
    const wrapper=document.createElement('section');wrapper.id='p20-detail-gallery';wrapper.className='p20-gallery';
    wrapper.innerHTML='<h3>Фотоатлас: '+entries.length+' фотографий</h3><p>Фото предоставлены авторами, соответствие виду по картинкам не аттестовано.</p>'+
      (entries.length?entries.map(x=>'<figure><img loading="lazy" src="'+html(x.file)+'" alt="'+html(b.name)+'"><figcaption>'+html(x.author||'автор по ссылке')+' · '+html(x.license||'')+'</figcaption><a href="'+html(x.source)+'" target="_blank" rel="noopener noreferrer">Источник ↗</a></figure>').join(''):'<div class="p20-message">Лицензированных фото пока нет.</div>');
    detail.querySelector('.detail-content')?.prepend(wrapper);
    const meta=document.createElement('div');meta.className='p20-message';const n=region.filter(x=>x.latin===b.latin).length;
    meta.textContent=n?'В выборке '+n+' опубликованных наблюдений сообщества для региона; наличие конкретного гриба не подтверждается по одному наблюдению.':'Подтверждённых региональных наблюдений в текущей выборке нет.';
    detail.querySelector('.detail-content')?.append(meta);
  }
  function renderQuality20(){
    const parent=$('quality');if(!parent)return;
    const q=core.quality(base,photos,gallery),marks=photoReview(),checked=Object.values(marks).filter(v=>v==='checked').length,
     issues=Object.values(marks).filter(v=>v==='issue').length;
    let extra=$('p20-qa-center');
    if(!extra){extra=document.createElement('div');extra.id='p20-qa-center';extra.className='p20-qa';parent.prepend(extra);}
    extra.innerHTML='<h3>Центр качества PRO 2.0</h3><p>Фотоотчёт основан на источнике и лицензии, не на экспертной визуальной идентификации. Ваши отметки остаются личными и не являются сертификацией.</p>'+
    '<div class="p20-mini-stats"><div><b>'+q.photoSpecies+'/'+q.species+'</b><span>видов с фото</span></div><div><b>'+q.galleryFiles+'</b><span>дополнительных кадров</span></div><div><b>'+checked+'</b><span>лично просмотрено</span></div><div><b>'+issues+'</b><span>ошибки по вашим отметкам</span></div></div>'+
    '<button class="p20-action" id="p20-audit-export">Экспорт проверки фото JSON</button>'+
    '<div class="p20-qa-rows">'+base.slice(0,120).map(b=>'<div class="p20-qa-row"><b>'+html(b.name)+'</b><span>'+ (core.eligiblePhoto(photos[b.latin])?'фото есть':'фото отсутствует')+'</span>'+
    '<button data-review20="checked" data-latin20="'+html(b.latin)+'">✓ Просмотрел</button><button data-review20="issue" data-latin20="'+html(b.latin)+'">! Ошибка</button>'+
    '<span>'+html(marks[b.latin]||'не проверено')+'</span></div>').join('')+'</div>';
  }
  function events(){
    document.addEventListener('click',ev=>{
      const b=ev.target.closest('button,[data-point20]');if(!b)return;
      if(b.dataset.stage20){show(b.dataset.stage20);return;}
      if(b.dataset.goto20){show(b.dataset.goto20);return;}
      if(b.dataset.part){$('p20-part-desc').textContent=anatomy[b.dataset.part];return;}
      if(b.dataset.month20){const month=Number(b.dataset.month20);document.querySelector('#season').value=String(month);document.querySelector('[data-page="catalog"]')?.click();document.querySelector('#season').dispatchEvent(new Event('change'));return;}
      if(b.dataset.point20!==undefined){handlePoint(Number(b.dataset.point20));return;}
      if(b.dataset.mode20!==undefined){document.body.classList.toggle('griby-field');b.textContent=document.body.classList.contains('griby-field')?'◉ Вернуть обычный интерфейс':'◉ Включить крупный интерфейс';return;}
    });
    $('p20-find').addEventListener('click',keyResults);
    $('p20-clear').addEventListener('click',()=>{$('p20-group').value='';$('p20-cap').value='';$('p20-habitat').value='';$('p20-id-results').replaceChildren();});
    $('p20-map-source').addEventListener('change',drawMap);$('p20-map-species').addEventListener('change',drawMap);
    $('p20-location-form').addEventListener('submit',e=>{e.preventDefault();
      const lat=Number($('p20-lat').value),lon=Number($('p20-lon').value),label=$('p20-loc-label').value.trim();
      if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<core.range.latMin||lat>core.range.latMax||lon<core.range.lonMin||lon>core.range.lonMax||!label){toast('Проверьте координаты и название');return;}
      const entries=personalGeo();entries.push({id:'mine-'+Date.now(),lat,lon,label:label.slice(0,80),kind:'personal'});
      try{localStorage.setItem(geoKey,JSON.stringify(entries.slice(-300)));$('p20-loc-label').value='';drawMap();toast('Точка хранится только на этом устройстве');}
      catch{toast('Нет места для сохранения точки');}
    });
    $('p20-export-geo').addEventListener('click',()=>download('MoOLVa-Griby-My-Places.json',JSON.stringify(personalGeo(),null,2),'application/json'));
    $('p20-csv').addEventListener('click',()=>{const notes=Array.isArray(oldData().diary)?oldData().diary:[];
      const csv=[['Дата','Вид','Место','Примечание'],...notes.map(x=>[x.date,byId.get(x.speciesId)?.name||'',x.place,x.notes||''])].map(a=>a.map(v=>'"'+String(v??'').replace(/\r?\n/g,' ').replace(/^[=+\-@]/,"'$&").replace(/"/g,'""')+'"').join(';')).join('\r\n');
      download('MoOLVa-Griby-Diary.csv','\ufeff'+csv,'text/csv;charset=utf-8');});
    $('p20-print').addEventListener('click',()=>window.print());
    $('p20-restore').addEventListener('click',()=>$('p20-restore-file').click());
    $('p20-restore-file').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f||f.size>3_000_000){toast('Выберите JSON размером до 3 МБ');return;}
      try{const raw=JSON.parse(await f.text()),parsed=core.safeBackup(raw,base.map(x=>x.id));
        if(!parsed){toast('Неверный файл резервной копии');return;}
        if(!window.confirm('Заменить текущие избранное и дневник данными из резервной копии?'))return;
        localStorage.setItem(oldKey,JSON.stringify(parsed));toast('Резерв восстановлен. Перезапустите приложение для обновления исходного дневника.');}
      catch{toast('Ошибка восстановления резервной копии');}});
    $('p20-pick-files').addEventListener('click',()=>$('p20-upload').click());
    $('p20-upload').addEventListener('change',e=>{const files=[...(e.target.files||[])].slice(0,3);cleanUploads();selectedFiles=files.filter(f=>f.size<=10_000_000&&/^image\/(png|jpeg|webp)$/.test(f.type));if(selectedFiles.length!==files.length)toast('Часть неподходящих файлов пропущена');
      uploadURLs=selectedFiles.map(f=>URL.createObjectURL(f));$('p20-preview').innerHTML=uploadURLs.map(url=>'<img src="'+html(url)+'" alt="Личная фотография">').join('');});
    $('p20-analyse').addEventListener('click',photoCompare);$('p20-photo-clear').addEventListener('click',cleanUploads);
    document.addEventListener('click',ev=>{if(ev.target.closest('[data-open]'))requestAnimationFrame(integrateDetail);});
    const viewer=new MutationObserver(()=>{if($('overlay')&&!$('overlay').hidden)integrateDetail();});
    viewer.observe($('detail'),{childList:true}); // No subtree observation: avoids recursive gallery injection.
    document.addEventListener('click',ev=>{if(ev.target.closest('[data-page="quality"]'))requestAnimationFrame(renderQuality20);});
    document.addEventListener('click',ev=>{if(ev.target?.id==='p20-audit-export'){const data={version:'2.0.0',created:new Date().toISOString(),audit:core.quality(base,photos,gallery),visualVerification:'not independently completed',personalReviews:photoReview()};download('MoOLVa-Griby-Photo-Audit.json',JSON.stringify(data,null,2),'application/json');}});
    document.addEventListener('click',ev=>{
      const b=ev.target.closest('[data-review20]');if(!b)return;const latin=b.dataset.latin20;
      if(!byLatin.has(latin)||!['checked','issue'].includes(b.dataset.review20))return;
      try{const r=photoReview();r[latin]=b.dataset.review20;localStorage.setItem(reviewKey,JSON.stringify(r));renderQuality20();toast('Личная отметка сохранена');}
      catch{toast('Не удалось записать отметку');}
    });
    $('p20-update-check')?.addEventListener('click',async ()=>{
      const status=$('p20-update-status');status.textContent='Проверка публичного релиза…';
      try{const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),9000);
        let response;try{response=await fetch('https://api.github.com/repos/svarshan/git-repo/releases/latest',{signal:controller.signal,cache:'no-store'});}
        finally{clearTimeout(timeout);}
        if(!response.ok)throw Error('Публичный релиз пока не найден');
        const info=await response.json(),url=info.html_url;
        if(!/^https:\/\/github\.com\/svarshan\/git-repo\/releases\/tag\//.test(url||''))throw Error('Некорректный источник обновления');
        status.replaceChildren();status.append(document.createTextNode('Доступный публичный релиз: '+String(info.tag_name||'неизвестен')+' · '));
        const link=document.createElement('a');link.href=url;link.textContent='Открыть безопасную страницу загрузки';link.target='_blank';link.rel='noopener noreferrer';status.append(link);
      }catch{status.textContent='Публичный релиз не найден или нет подключения. Текущая версия продолжает работать офлайн.';}
    });
    window.addEventListener('pagehide',cleanUploads);
  }
  events();renderQuality20();
  // Center can use new data without mutating the user's original 1.0 diary.
  window.MoOLVa20={show,renderMap,renderCalendar,renderStats,version:'2.0.0'};
})();
