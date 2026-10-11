/* MoOLVa 3.0.3: six current-month PDFs in one ZIP, generated only from stored records. */
(function(){
'use strict';
const ITEMS=[
 ['fridge','Журнал температур холодильников'],
 ['brakerage','Журнал бракеража готовой продукции'],
 ['incoming','Журнал входного контроля сырья'],
 ['cleaning','Журнал санитарной обработки'],
 ['hygiene','Журнал здоровья сотрудников'],
 ['equipment','Журнал контроля оборудования']
];
let panel=null, trigger=null, busy=false, chosen=new Set(ITEMS.map(x=>x[0]));
const get=id=>document.getElementById(id);
function update(){
 if(!panel)return;
 const n=chosen.size;
 get('bulk303-count').textContent=n+' из 6';
 get('bulk303-run').disabled=busy||n===0;
 get('bulk303-run').textContent=busy?'Формирую документы…':
   ('↓ Скачать '+n+' '+(n===1?'журнал':n<5?'журнала':'журналов')+' PDF (ZIP)');
 get('bulk303-all').textContent=n===6?'Снять выделение':'Выбрать все';
}
function close(){
 if(busy||!panel)return;
 panel.hidden=true;
 if(trigger)trigger.focus();
}
function open(){
 if(!state.venue){toast('Сначала выберите предприятие');return;}
 if(!currentAccount){toast('Войдите в личный кабинет');return;}
 chosen=new Set(ITEMS.map(x=>x[0]));
 panel.querySelectorAll('input[type=checkbox]').forEach(x=>x.checked=true);
 get('bulk303-company').textContent=state.venue_details?.venue_name||
     state.venues?.find(x=>x.id===state.venue)?.venue_name||'Выбранное предприятие';
 get('bulk303-month').textContent=new Intl.DateTimeFormat('ru-RU',{month:'long',year:'numeric'}).format(new Date());
 get('bulk303-status').textContent='Включаются только уже сохранённые действующие записи; плановые и отменённые исключены.';
 panel.hidden=false;update();get('bulk303-run').focus();
}
function decodeZip(base64){
 const chunks=[];
 for(let i=0;i<base64.length;i+=32768){
  const raw=atob(base64.slice(i,i+32768));
  const bytes=new Uint8Array(raw.length);
  for(let j=0;j<raw.length;j++)bytes[j]=raw.charCodeAt(j);
  chunks.push(bytes);
 }
 return new Blob(chunks,{type:'application/zip'});
}
async function download(){
 if(busy||chosen.size===0)return;
 const company=state.venue;
 const codes=ITEMS.filter(x=>chosen.has(x[0])).map(x=>x[0]);
 busy=true;update();
 get('bulk303-status').textContent='Создаю PDF из реальных записей выбранного предприятия…';
 try{
   const data=await act('bulk303_export',{codes});
   if(company!==state.venue)throw Error('Предприятие изменилось — запустите выгрузку заново');
   if(!data.zip_b64||data.count!==codes.length||data.mime!=='application/zip')
     throw Error('Неполный результат экспорта');
   const file=decodeZip(data.zip_b64);
   const uri=URL.createObjectURL(file);
   const link=document.createElement('a');
   link.href=uri;link.download=data.filename||'MoOLVa_Журналы_PDF.zip';
   link.hidden=true;document.body.appendChild(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(uri),30000);
   const empty=(data.journals||[]).filter(x=>x.records===0).length;
   get('bulk303-status').textContent=
      'Готово: '+data.count+' PDF; '+data.total_records+' сохранённых записей, '+
      data.period_start+' — '+data.period_end+
      (empty?'. Без записей за месяц: '+empty+' журнал(ов).':'')+
      '. ZIP отправлен в загрузки Windows.';
   toast('Готово. Проверьте папку загрузок.');
 }catch(e){
   get('bulk303-status').textContent='Ошибка выгрузки: '+(e?.message||'Неизвестная ошибка');
   toast(e?.message||'Не удалось выгрузить документы');
 }finally{busy=false;update();}
}
function install(){
 if(get('bulk303-open'))return;
 const root=get('journals-page');
 const head=root?.querySelector('.heading');
 if(!head)return;
 trigger=document.createElement('button');
 trigger.id='bulk303-open';trigger.type='button';trigger.className='btn primary';
 trigger.textContent='↓ Выгрузить журналы PDF';
 trigger.title='Выгрузить выбранные журналы за текущий месяц';
 trigger.addEventListener('click',open);
 head.appendChild(trigger);

 panel=document.createElement('div');panel.id='bulk303-modal';panel.className='bulk303-overlay';
 panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');
 panel.setAttribute('aria-labelledby','bulk303-title');
 const fields=ITEMS.map(([code,title])=>'<label class="bulk303-item"><input type="checkbox" value="'+code+'" checked><span>'+title+'</span></label>').join('');
 panel.innerHTML=
 '<section class="bulk303-content">'+
 '<header class="bulk303-header"><div><h2 id="bulk303-title">Выгрузить журналы</h2>'+
 '<p>Выберите нужные документы — программа сформирует один ZIP</p></div>'+
 '<button type="button" class="btn" id="bulk303-close" aria-label="Закрыть окно">×</button></header>'+
 '<div class="bulk303-facts">'+
 '<div><small>Предприятие</small><b id="bulk303-company"></b></div>'+
 '<div><small>Период</small><b id="bulk303-month">Текущий месяц</b></div>'+
 '<div><small>Формат</small><b>PDF в ZIP</b></div>'+
 '<div><small>Данные</small><b>Заполненные записи</b></div></div>'+
 '<div class="bulk303-select"><strong>Журналы</strong><span id="bulk303-count">6 из 6</span>'+
 '<button class="btn" type="button" id="bulk303-all">Снять выделение</button></div>'+
 '<div class="bulk303-items" id="bulk303-items">'+fields+'</div>'+
 '<p class="bulk303-hint">Экспортируется только то, что сотрудники фактически сохранили. '+
 'Подписи и измерения не генерируются. Если журнал пуст, в PDF будет отмечено отсутствие записей.</p>'+
 '<div class="bulk303-status" id="bulk303-status" aria-live="polite"></div>'+
 '<div class="bulk303-actions"><button class="btn" type="button" id="bulk303-cancel">Закрыть</button>'+
 '<button class="btn primary" type="button" id="bulk303-run">↓ Скачать 6 журналов PDF (ZIP)</button>'+
 '</div></section>';
 document.body.appendChild(panel);
 get('bulk303-close').addEventListener('click',close);
 get('bulk303-cancel').addEventListener('click',close);
 get('bulk303-run').addEventListener('click',download);
 get('bulk303-all').addEventListener('click',()=>{
   chosen=chosen.size===6?new Set():new Set(ITEMS.map(x=>x[0]));
   panel.querySelectorAll('input[type=checkbox]').forEach(x=>x.checked=chosen.has(x.value));
   update();
 });
 panel.querySelectorAll('input[type=checkbox]').forEach(x=>x.addEventListener('change',()=>{
   if(x.checked)chosen.add(x.value);else chosen.delete(x.value);
   update();
 }));
 panel.addEventListener('click',e=>{if(e.target===panel)close();});
 document.addEventListener('keydown',e=>{
   if(e.key==='Escape'&&!panel.hidden){e.preventDefault();close();}
 });
 const style=document.createElement('style');
 style.textContent='.bulk303-overlay{position:fixed;inset:0;z-index:120000;background:rgba(7,13,28,.78);display:flex;align-items:center;justify-content:center;padding:12px}.bulk303-overlay[hidden]{display:none}.bulk303-content{width:min(760px,100%);max-height:93vh;overflow:auto;padding:20px;background:#1b2d4d;border:1px solid #58729d;border-radius:17px;box-shadow:0 25px 65px #0009;color:#f3f6ff}.bulk303-header,.bulk303-select,.bulk303-actions{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px}.bulk303-header h2{font-size:22px;margin:0 0 5px}.bulk303-header p,.bulk303-hint{color:#bdd0ea;font-size:13px;line-height:1.6}.bulk303-facts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:17px 0}.bulk303-facts>div{background:#273b5e;border-radius:9px;padding:11px;min-width:0;overflow-wrap:anywhere}.bulk303-facts small{font-size:11px;color:#b9c9e0;display:block;margin-bottom:5px}.bulk303-facts b{font-size:12px}.bulk303-items{display:grid;gap:7px;margin:12px 0}.bulk303-item{display:flex;align-items:center;gap:10px;padding:12px;border:1px solid #455c84;border-radius:10px;background:#283b5c;cursor:pointer}.bulk303-item input{width:20px;height:20px;flex:none;accent-color:#5de2ae}.bulk303-item:has(input:checked){border-color:#58a890;background:#204251}.bulk303-select{margin-top:12px}.bulk303-status{color:#e0ebf9;font-size:13px;line-height:1.5;margin:12px 0;min-height:18px}.bulk303-actions{margin-top:15px}.bulk303-actions button:last-child{flex:1;min-height:45px}@media(max-width:650px){.bulk303-facts{grid-template-columns:repeat(2,minmax(0,1fr))}.bulk303-content{padding:14px}.bulk303-actions button{flex:1}}';
 document.head.appendChild(style);
}
window.MoOLVaBulk303={install,open,download};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
else install();
})();