'use strict';
/* 7.7 offline navigation: keyboard command palette, pinned pages, custom width, no changes to legacy keys. */
(function(){
 const core=window.MoOLVa77Core,birds=Array.isArray(window.BIRDS_DATA)?window.BIRDS_DATA:[];
 if(!core)return;
 const key='ptitsy-nn.ui77.v1',root=document.getElementById('m77Palette'),searchBox=document.getElementById('m77Query');
 const options=document.getElementById('m77Results'),hint=document.getElementById('m77PaletteHint'),pins=document.getElementById('m77Pins');
 const pinSettings=document.getElementById('m77PinSettings'),width=document.getElementById('m77Width'),open=document.getElementById('m77Open');
 const pages=[['catalog','Главная'],['field','Определитель'],['assistant','Умный поиск'],['birdai','Bird AI по голосу'],['map','Карта птиц'],['journal','Дневник'],['pro75','Полевой центр'],['expedition','Экспедиции'],['comparebirds6','Сравнение видов'],['gallery','Фотографии'],['lab','Аудиолаборатория'],['articles','Энциклопедия'],['academy','Академия'],['calendar','Календарь'],['conservation','Красная книга'],['favorites','Избранное'],['settings','Настройки'],['about','Источники и лицензии']];
 const labels=new Map(pages),defaultPins=[]; // Start clean: no duplicate core buttons
 const make=(tag,txt,cls)=>{const n=document.createElement(tag);if(txt!=null)n.textContent=String(txt);if(cls)n.className=cls;return n;};
 let state={width:270,pinned:defaultPins.slice()},index=0,shown=[];
 try{const saved=JSON.parse(localStorage.getItem(key)||'{}');
  if(saved&&typeof saved==='object'){
   if(Number.isFinite(saved.width))state.width=Math.max(235,Math.min(340,saved.width));
   if(Array.isArray(saved.pinned))state.pinned=[...new Set(saved.pinned.filter(id=>labels.has(id)))].slice(0,7);
  }
 }catch{}
 const store=()=>{try{localStorage.setItem(key,JSON.stringify(state));}catch{}};
 function apply(){
  document.documentElement.style.setProperty('--m77-sidebar-width',state.width+'px');
  if(width)width.value=String(state.width);
  const tag=document.getElementById('m77WidthValue');if(tag)tag.textContent=state.width+' пикс.';
  if(pins){
   pins.replaceChildren();
   for(const id of state.pinned){
    const original=document.querySelector('aside.sidebar button[data-view="'+id+'"]');
    const b=original?original.cloneNode(true):make('button',labels.get(id));
    b.dataset.view=id;b.classList.remove('navactive');
    b.title='Закреплено: '+labels.get(id);b.setAttribute('aria-label',labels.get(id));
    pins.appendChild(b);
   }
   pins.hidden=!state.pinned.length;
  }
 }
 function renderPinSettings(){
  if(!pinSettings)return;
  pinSettings.replaceChildren();
  for(const [id,name] of pages.filter(p=>!['settings','about','catalog','birdai','map','journal','pro75'].includes(p[0]))){
   const row=make('label',null,'m77-pin-choice');
   const box=make('input');box.type='checkbox';box.value=id;box.checked=state.pinned.includes(id);
   box.addEventListener('change',()=>{
    state.pinned=box.checked?[...state.pinned,id].slice(0,7):state.pinned.filter(x=>x!==id);
    store();renderPinSettings();apply();
   });
   row.append(box,make('span',name));pinSettings.append(row);
  }
 }
 width?.addEventListener('input',()=>{state.width=Math.max(235,Math.min(340,Number(width.value)||270));apply();store();});
 function navigate(item){
  if(!item)return;
  closePalette();
  if(item.kind==='bird'){document.dispatchEvent(new CustomEvent('living-open',{detail:item.id}));return;}
  const button=document.querySelector('button[data-view="'+item.id+'"]');
  if(button){button.click();return;}
  const section=document.getElementById(item.id);
  if(section){document.querySelectorAll('.view').forEach(x=>x.hidden=x!==section);}
 }
 function matches(q){
  const f=core.fold(q);const nav=pages.filter(([id,name])=>!f||core.fold(name).includes(f)||core.fold(id).includes(f)).map(([id,name])=>({kind:'page',id,label:name}));
  const found=f?core.search(birds,q,14).map(x=>({kind:'bird',id:x.bird.id,label:x.bird.name,sub:x.bird.latin})):birds.filter(b=>b.imageFile).slice(0,5).map(b=>({kind:'bird',id:b.id,label:b.name,sub:b.latin}));
  return [...nav,...found].slice(0,25);
 }
 function draw(){
  if(!options||!searchBox)return;
  shown=matches(searchBox.value);index=Math.max(0,Math.min(index,shown.length-1));options.replaceChildren();
  if(!shown.length){options.append(make('p','Ничего не найдено. Уточните название или признаки.','living-note'));return;}
  shown.forEach((x,i)=>{
   const btn=make('button',null,'m77-item'+(i===index?' m77-selected':''));btn.type='button';btn.setAttribute('role','option');btn.setAttribute('aria-selected',String(i===index));
   btn.append(make('strong',x.label),make('small',x.kind==='bird'?'Птица · '+(x.sub||''):'Раздел приложения'));
   btn.addEventListener('pointerenter',()=>{index=i;[...options.querySelectorAll('.m77-item')].forEach((e,j)=>{e.classList.toggle('m77-selected',j===i);e.setAttribute('aria-selected',String(j===i));});});
   btn.addEventListener('click',()=>navigate(x));
   options.append(btn);
  });
 }
 function showPalette(){
  if(!root)return;root.hidden=false;index=0;if(searchBox)searchBox.value='';
  draw();searchBox?.focus();
 }
 function closePalette(){if(root)root.hidden=true;}
 open?.addEventListener('click',showPalette);
 document.getElementById('m77Close')?.addEventListener('click',closePalette);
 document.getElementById('m77Shade')?.addEventListener('click',closePalette);
 searchBox?.addEventListener('input',()=>{index=0;draw();});
 searchBox?.addEventListener('keydown',e=>{
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();index=(index+(e.key==='ArrowDown'?1:-1)+shown.length)%Math.max(1,shown.length);draw();}
  if(e.key==='Enter'){e.preventDefault();navigate(shown[index]);}
 });
 document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();root?.hidden?showPalette():closePalette();}
  if(e.key==='Escape'&&root&&!root.hidden){e.preventDefault();closePalette();}
 });
 const nav=document.querySelector('aside.sidebar nav .m76-nav-core');
 if(nav&&pins)nav.after(pins);
 renderPinSettings();apply();
})();
