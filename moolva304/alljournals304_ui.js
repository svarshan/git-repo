/* MoOLVa 3.0.4: all journals for this enterprise + inspection self-review pack.
   Shows suggestions, not a legally certified or exhaustive compliance checklist. */
(function(){
'use strict';
let modal=null, opener=null, all=[], chosen=new Set(), busy=false, show='recommended';
let loadedVenue=0, loadedRange='', updating=false, serial=0;
const el=id=>document.getElementById(id);
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
function dateISO(d){
 const year=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0');
 return year+'-'+m+'-'+String(d.getDate()).padStart(2,'0');
}
function today(){return new Date();}
function period(type){
 const t=today();
 if(type==='month')return [dateISO(new Date(t.getFullYear(),t.getMonth(),1)),dateISO(t)];
 if(type==='last')return [dateISO(new Date(t.getFullYear(),t.getMonth()-1,1)),dateISO(new Date(t.getFullYear(),t.getMonth(),0))];
 if(type==='quarter')return [dateISO(new Date(t.getFullYear(),t.getMonth()-2,1)),dateISO(t)];
 return [dateISO(new Date(t.getFullYear(),0,1)),dateISO(t)];
}
function range(){return [el('all304-start').value,el('all304-end').value];}
function selectedCount(){return chosen.size;}
function filter(item){
 if(show==='recommended'&&!item.recommended)return false;
 if(show==='recorded'&&!item.records)return false;
 if(show==='custom'&&!item.user_created)return false;
 const query=(el('all304-search')?.value||'').trim().toLocaleLowerCase('ru');
 if(query && !(item.title+' '+item.group+' '+item.reason).toLocaleLowerCase('ru').includes(query))return false;
 return true;
}
function updateCount(){
 if(!modal)return;
 const size=chosen.size;
 el('all304-selected').textContent=size+' журналов';
 el('all304-run').disabled=busy||updating||!size;
 el('all304-run').textContent=busy?'Формирую комплект PDF…':
   '↓ Скачать '+size+' '+(size===1?'журнал':size<5?'журнала':'журналов')+' (PDF/ZIP)';
}
function render(){
 if(!modal)return;
 const relevant=all.filter(filter);
 const groups=new Map();
 for(const item of relevant){
   if(!groups.has(item.group))groups.set(item.group,[]);
   groups.get(item.group).push(item);
 }
 const items=[];
 for(const [group,entries] of groups){
   items.push('<div class="all304-group">'+esc(group)+'</div>');
   for(const x of entries){
     items.push('<label class="all304-item"><input type="checkbox" data-journal="'+esc(x.code)+'"'+
       (chosen.has(x.code)?' checked':'')+'><span class="all304-item-main">'+
       '<strong>'+esc(x.title)+'</strong><small>'+esc(x.reason)+'</small></span>'+
       '<span class="all304-meta">'+x.records+' записей'+
       (x.recommended?'<small>Рекомендовано</small>':'')+
       (x.user_created?'<small>Мой журнал</small>':'')+
       '</span></label>');
   }
 }
 el('all304-list').innerHTML=items.join('')||
   '<p class="all304-empty">Нет журналов с такими условиями. Попробуйте выбрать «Все журналы».</p>';
 el('all304-list').querySelectorAll('input[data-journal]').forEach(c=>{
   c.addEventListener('change',()=>{
     if(c.checked)chosen.add(c.dataset.journal); else chosen.delete(c.dataset.journal);
     updateCount();
   });
 });
 el('all304-summary').textContent='Всего в каталоге: '+all.length+
   ' · предложено для предприятия: '+all.filter(x=>x.recommended).length+
   ' · без записей среди предложенных: '+all.filter(x=>x.recommended&&!x.records).length;
 const opts=modal.querySelectorAll('button[data-view]');
 opts.forEach(b=>b.classList.toggle('active',b.dataset.view===show));
 updateCount();
}
function close(){
 if(busy||!modal)return;
 modal.hidden=true;
 if(opener)opener.focus();
}
async function load({initial=false}={}){
 if(!state.venue)return;
 const ticket=++serial,venue=state.venue;
 const dates=range().join('|');
 updating=true;updateCount();
 el('all304-status').textContent='Получаю список журналов из базы предприятия…';
 try{
   const data=await act('bulk304_catalog',{start:range()[0],end:range()[1]});
   if(ticket!==serial||venue!==state.venue||modal.hidden)return;
   all=data.items||[];
   if(initial){
     chosen=new Set(all.filter(x=>x.recommended).map(x=>x.code));
     show='recommended';
   }else{
     chosen=new Set([...chosen].filter(code=>all.some(x=>x.code===code)));
   }
   loadedVenue=venue;loadedRange=dates;
   el('all304-company').textContent=data.venue_name+' · '+data.venue_kind;
   el('all304-status').textContent=data.notice;
   render();
 }catch(e){
   if(ticket!==serial)return;
   el('all304-status').textContent='Не удалось загрузить журналы: '+e.message;
   toast(e.message);
 }finally{if(ticket===serial){updating=false;updateCount();}}
}
function open(){
 if(!state.venue){toast('Выберите предприятие');return;}
 if(!currentAccount){toast('Необходимо войти в программу');return;}
 const d=period('month');
 el('all304-period').value='month';
 el('all304-start').value=d[0];
 el('all304-end').value=d[1];
 el('all304-search').value='';
 el('all304-inspection').checked=true;
 modal.hidden=false;all=[];chosen=new Set();show='recommended';
 render();load({initial:true});
}
function decodeZip(input){
 const pieces=[];
 for(let i=0;i<input.length;i+=32768){
   const bin=atob(input.slice(i,i+32768));
   const bytes=new Uint8Array(bin.length);
   for(let j=0;j<bin.length;j++)bytes[j]=bin.charCodeAt(j);
   pieces.push(bytes);
 }
 return new Blob(pieces,{type:'application/zip'});
}
async function download(){
 if(busy||updating||!chosen.size)return;
 if(loadedRange!==range().join('|')||loadedVenue!==state.venue){
   toast('Период или предприятие изменилось. Обновите список журналов.');
   return;
 }
 const venue=state.venue;
 const start=el('all304-start').value,end=el('all304-end').value;
 const inspection=!!el('all304-inspection').checked;
 const codes=all.filter(x=>chosen.has(x.code)).map(x=>x.code);
 busy=true;updateCount();
 el('all304-status').textContent='Готовлю PDF по фактическим записям. Это может занять некоторое время…';
 try{
   const answer=await act('bulk304_export',{codes,start,end,inspection});
   if(venue!==state.venue)throw Error('Предприятие изменилось во время выгрузки');
   if(!answer.zip_b64||answer.count!==codes.length)throw Error('Получен неполный архив');
   const blob=decodeZip(answer.zip_b64);
   const url=URL.createObjectURL(blob);
   const link=document.createElement('a');
   link.href=url;link.download=answer.filename||'MoOLVa_Журналы_для_проверки.zip';
   link.hidden=true;document.body.appendChild(link);link.click();link.remove();
   window.setTimeout(()=>URL.revokeObjectURL(url),30000);
   el('all304-status').textContent='Готово: '+answer.count+' журналов, '+
     answer.total_records+' сохранённых записей. '+answer.empty_recommended.length+
     ' рекомендованных журналов без записей за выбранный период. Архив в загрузках.';
   toast('Комплект PDF сформирован и отправлен в загрузки');
 }catch(e){
   el('all304-status').textContent='Ошибка: '+(e?.message||'Не удалось сформировать архив');
   toast(e?.message||'Ошибка выгрузки');
 }finally{busy=false;updateCount();}
}
function install(){
 if(el('all304-open'))return;
 const root=el('journals-page'),head=root?.querySelector('.heading');
 if(!head)return;
 opener=document.createElement('button');
 opener.type='button';opener.id='all304-open';opener.className='btn primary';
 opener.textContent='▣ Все журналы / для проверки';
 opener.title='Подобрать по типу предприятия и выгрузить любые журналы';
 opener.addEventListener('click',open);
 head.appendChild(opener);
 modal=document.createElement('div');
 modal.className='all304-overlay';modal.id='all304-modal';modal.hidden=true;
 modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');
 modal.setAttribute('aria-labelledby','all304-title');
 modal.innerHTML=
 '<section class="all304-sheet">'+
 '<header class="all304-head"><div><h2 id="all304-title">Журналы для предприятия и проверки</h2>'+
 '<p id="all304-company"></p></div><button class="btn" type="button" id="all304-close">× Закрыть</button></header>'+
 '<div class="all304-notice">Программа предлагает формы по процессам предприятия. '+
 'Это не гарантированный перечень документов Роспотребнадзора: утвердите его по вашей ППК и ХАССП.</div>'+
 '<div class="all304-controls">'+
 '<label>Период<select id="all304-period"><option value="month">Текущий месяц</option>'+
 '<option value="last">Прошлый месяц</option><option value="quarter">Последние 3 месяца</option>'+
 '<option value="year">С начала года</option><option value="custom">Выбрать даты</option></select></label>'+
 '<label>С<input id="all304-start" type="date"></label>'+
 '<label>По<input id="all304-end" type="date"></label></div>'+
 '<div class="all304-filters"><button type="button" class="btn active" data-view="recommended">Для моего предприятия</button>'+
 '<button type="button" class="btn" data-view="all">Все журналы</button>'+
 '<button type="button" class="btn" data-view="recorded">С записями</button>'+
 '<button type="button" class="btn" data-view="custom">Мои журналы</button></div>'+
 '<input id="all304-search" class="all304-search" placeholder="Поиск: температура, бракераж, склад, санитария…" aria-label="Найти журнал">'+
 '<div class="all304-selection"><b id="all304-summary"></b>'+
 '<div><button type="button" id="all304-recommended" class="btn">Выбрать рекомендованные</button>'+
 '<button type="button" id="all304-select-all" class="btn">Выбрать все</button>'+
 '<button type="button" id="all304-none" class="btn">Снять все</button></div></div>'+
 '<div class="all304-list" id="all304-list" aria-label="Доступные журналы"></div>'+
 '<label class="all304-check"><input id="all304-inspection" type="checkbox" checked>'+
 '<span><b>Добавить лист самопроверки перед визитом Роспотребнадзора</b>'+
 '<small>Отдельный PDF: список записей, выявленные пропуски, перечень документов и вопросы для проверки ответственным.</small></span></label>'+
 '<div id="all304-status" class="all304-status" aria-live="polite"></div>'+
 '<footer class="all304-footer"><span id="all304-selected">0 журналов</span>'+
 '<button type="button" class="btn primary" id="all304-run">↓ Скачать PDF (ZIP)</button></footer>'+
 '</section>';
 document.body.appendChild(modal);
 el('all304-close').addEventListener('click',close);
 el('all304-run').addEventListener('click',download);
 el('all304-search').addEventListener('input',render);
 modal.querySelectorAll('button[data-view]').forEach(x=>x.addEventListener('click',()=>{
   show=x.dataset.view;render();
 }));
 el('all304-recommended').addEventListener('click',()=>{
   chosen=new Set(all.filter(x=>x.recommended).map(x=>x.code));render();
 });
 el('all304-select-all').addEventListener('click',()=>{
   chosen=new Set(all.map(x=>x.code));render();
 });
 el('all304-none').addEventListener('click',()=>{chosen=new Set();render();});
 el('all304-period').addEventListener('change',()=>{
   const value=el('all304-period').value;
   if(value!=='custom'){
     const d=period(value);el('all304-start').value=d[0];el('all304-end').value=d[1];
     load();
   }
 });
 const validateManual=()=>{
   el('all304-period').value='custom';
   if(el('all304-start').value && el('all304-end').value) load();
 };
 el('all304-start').addEventListener('change',validateManual);
 el('all304-end').addEventListener('change',validateManual);
 modal.addEventListener('click',e=>{if(e.target===modal)close();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden){close();e.preventDefault();}});
 const style=document.createElement('style');
 style.textContent='.all304-overlay{position:fixed;inset:0;z-index:120500;background:rgba(6,13,29,.8);display:flex;justify-content:center;align-items:center;padding:12px}.all304-overlay[hidden]{display:none}.all304-sheet{width:min(1020px,100%);max-height:94vh;overflow:auto;background:#192b49;color:#f3f6ff;border:1px solid #55739d;box-shadow:0 24px 70px #000b;border-radius:15px;padding:20px}.all304-head,.all304-footer,.all304-selection{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.all304-head h2{font-size:22px;margin:0}.all304-head p{color:#a8c5e5;margin:5px 0}.all304-notice{background:#2c3f57;border-left:3px solid #f0be72;padding:11px;margin:12px 0;border-radius:5px;font-size:12px;line-height:1.6}.all304-controls{display:grid;grid-template-columns:2fr 1fr 1fr;gap:9px;margin:12px 0}.all304-controls label{display:grid;gap:5px;color:#d3e2f1;font-size:12px}.all304-controls input,.all304-controls select,.all304-search{width:100%;min-width:0;background:#233754;border:1px solid #5876a2;border-radius:8px;color:#fff;padding:10px;box-sizing:border-box}.all304-filters{display:flex;flex-wrap:wrap;gap:7px;margin:13px 0}.all304-filters .active{background:#41637c;border-color:#75b6bb}.all304-search{margin:0 0 10px}.all304-selection{color:#bbd0e9;font-size:12px}.all304-selection>div{display:flex;gap:5px;flex-wrap:wrap}.all304-list{max-height:36vh;min-height:180px;overflow:auto;margin:10px 0;border:1px solid #415778;border-radius:10px;padding:8px;background:#172a47}.all304-group{font-size:12px;font-weight:700;padding:10px 8px;color:#9dddcf;text-transform:uppercase}.all304-item{display:flex;gap:10px;align-items:start;padding:9px 8px;border-radius:8px;cursor:pointer}.all304-item:hover{background:#263c5d}.all304-item input{accent-color:#4edab0;width:18px;height:18px;flex-shrink:0}.all304-item-main{display:grid;gap:3px;flex:1}.all304-item-main strong{font-size:13px}.all304-item-main small,.all304-meta small,.all304-check small{font-size:11px;color:#b6cce6;line-height:1.5}.all304-meta{display:flex;align-items:end;flex-direction:column;gap:2px;font-size:11px;color:#9de1d0;white-space:nowrap}.all304-empty{color:#c4d0e5;padding:20px}.all304-check{display:flex;align-items:start;gap:10px;padding:13px;background:#254260;border:1px solid #506f93;border-radius:11px}.all304-check input{width:19px;height:19px;accent-color:#4fdca9;flex-shrink:0}.all304-check span{display:grid;gap:4px}.all304-check b{font-size:13px}.all304-status{min-height:26px;font-size:12px;line-height:1.5;color:#d1e3f5;margin:12px 0}.all304-footer button{min-height:44px}@media(max-width:650px){.all304-sheet{padding:12px}.all304-controls{grid-template-columns:1fr 1fr}.all304-controls label:first-child{grid-column:span 2}.all304-list{max-height:32vh}.all304-meta{white-space:normal;text-align:right;max-width:95px}.all304-item-main strong{font-size:12px}}';
 document.head.appendChild(style);
}
window.MoOLVaAllJournals304={open,load,download};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
else install();
})();