/* MoOLVa 3.0.5: plain-language recipe catalogue and approval workspace.
   Imported source recipes are draft data, never automatically legally approved. */
(function(){
'use strict';
let modal=null,openBtn=null,tab='catalog',pageIndex=0,category='',query='',catalog=[],myCards=[];
let active=null,selected=new Set(),busy=false,total=0,loading=0;
const get=id=>document.getElementById(id);
const esc=v=>String(v===undefined||v===null?'':v).replace(/[&<>"']/g,c=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
const categories=['','Основные блюда','Салаты','Супы','Каши','Напитки'];
const flagNames={
 recipe_checked:'Рецептура, брутто и нетто проверены',
 technology_checked:'Технология приготовления проверена',
 safety_checked:'Хранение и безопасность проверены',
 nutrition_checked:'КБЖУ и метод расчёта проверены',
 source_checked:'Источник рецептуры проверен'
};
function button(label,fn,cls='btn'){
 let x=document.createElement('button');x.type='button';x.className=cls;x.textContent=label;x.onclick=fn;return x;
}
function status(text){if(get('ttk305-status'))get('ttk305-status').textContent=text;}
function venueReady(){
 if(!state.venue){toast('Сначала выберите предприятие');return false;}
 if(!currentAccount){toast('Войдите в программу');return false;}
 return true;
}
function tabs(){
 ['catalog','mine'].forEach(name=>{
  let x=get('ttk305-'+name+'-tab');if(x)x.classList.toggle('active',tab===name);
 });
 get('ttk305-cat-tools').hidden=(tab!=='catalog');
 get('ttk305-mine-tools').hidden=(tab!=='mine');
}
function updateSelections(){
 const len=selected.size;
 if(get('ttk305-selected'))get('ttk305-selected').textContent=len+' выбрано';
 get('ttk305-export').disabled=busy||len===0||len>50;
 get('ttk305-export').textContent=len>50?'Выберите не более 50 карт':'↓ Выгрузить выбранные ТК/ТТК';
}
function renderCatalog(){
 const root=get('ttk305-items');
 root.innerHTML='';
 for(const entry of catalog){
  const card=document.createElement('article');card.className='ttk305-item';
  const label=document.createElement('div');label.className='ttk305-item-text';
  label.innerHTML='<b>'+esc(entry.title)+'</b><small>'+esc(entry.category)+
   ' · '+esc(entry.kind)+' · Требует проработки</small>';
  card.appendChild(label);
  card.appendChild(button('Добавить в мои карты',async()=>{
   if(busy)return;
   busy=true;status('Добавляю рецепт в черновики…');
   try{
    const r=await act('ttk305_import',{code:entry.code});
    status('Блюдо добавлено. Проверьте фактическую рецептуру, КБЖУ и сроки хранения.');
    tab='mine';pageIndex=0;selected.clear();await load();
    openEditor(r);
   }catch(e){toast(e.message);status('Не удалось добавить: '+e.message);}
   finally{busy=false;}
  },'btn primary'));
  root.appendChild(card);
 }
 if(!catalog.length)root.innerHTML='<p class="ttk305-muted">Блюд не найдено, измените запрос.</p>';
 get('ttk305-count').textContent='Найдено: '+total+' · страница '+(pageIndex+1);
 get('ttk305-prev').disabled=pageIndex===0;
 get('ttk305-next').disabled=(pageIndex+1)*45>=total;
}
function renderMine(){
 const root=get('ttk305-items');
 root.innerHTML='';
 for(const item of myCards){
  const card=document.createElement('article');card.className='ttk305-item';
  const checkbox=document.createElement('input');checkbox.type='checkbox';
  checkbox.checked=selected.has(item.id);checkbox.setAttribute('aria-label','Выгрузить '+item.title);
  checkbox.onchange=()=>{
    if(checkbox.checked)selected.add(item.id);else selected.delete(item.id);
    updateSelections();
  };
  card.appendChild(checkbox);
  const copy=document.createElement('div');copy.className='ttk305-item-text';
  const warning=item.status==='approved'?'В системе утверждена':'Черновик · требует проверки';
  copy.innerHTML='<b>'+esc(item.title)+'</b><small>'+esc(item.category)+' · '+
    esc(item.kind)+' · Версия '+item.version+' · '+warning+
    (item.problems?.length?' · Незаполнено '+item.problems.length:'')+'</small>';
  card.appendChild(copy);
  card.appendChild(button('Открыть',async()=>{
   try{openEditor(await act('ttk305_get',{id:item.id}));}catch(e){toast(e.message);}
  }));
  root.appendChild(card);
 }
 if(!myCards.length)root.innerHTML='<p class="ttk305-muted">Пока нет сохранённых карт. Выберите блюдо из каталога.</p>';
 get('ttk305-count').textContent='Мои карты: '+total;
 get('ttk305-prev').disabled=pageIndex===0;
 get('ttk305-next').disabled=(pageIndex+1)*45>=total;
 updateSelections();
}
async function load(){
 if(!venueReady())return;
 tabs();get('ttk305-items').innerHTML='<p class="ttk305-muted">Загружаю…</p>';
 const current=++loading,venue=state.venue;
 try{
  if(tab==='catalog'){
   const r=await act('ttk305_catalog',{query,category,start:pageIndex*45,limit:45});
   if(current!==loading||venue!==state.venue)return;
   catalog=r.items||[];total=r.total||0;renderCatalog();
   status('Каталог: '+r.catalog_size+' авторских проектных карт. Это не утверждённые рецептуры и не готовые нормативные документы.');
  }else{
   const r=await act('ttk305_list',{query:get('ttk305-mine-search').value||'',start:pageIndex*45,limit:45});
   if(current!==loading||venue!==state.venue)return;
   myCards=r.items||[];total=r.total||0;renderMine();
   status('Перед использованием карты необходимо проверить рецептуру и утвердить её ответственным лицом.');
  }
 }catch(e){
  get('ttk305-items').textContent='Ошибка: '+e.message;
  toast(e.message);
 }
}
function renderIngredients(rows){
 const table=get('ttk305-ing-body');
 table.innerHTML='';
 rows.forEach((x,i)=>{
  const row=document.createElement('tr');
  row.innerHTML='<td><input data-ingredient-name="'+i+'" value="'+esc(x.name)+'" placeholder="Продукт"></td>'+
    '<td><input type="number" min="0.1" step="0.1" data-ingredient-gross="'+i+'" value="'+esc(x.gross_g)+'"></td>'+
    '<td><input type="number" min="0.1" step="0.1" data-ingredient-net="'+i+'" value="'+esc(x.net_g)+'"></td>'+
    '<td><input type="checkbox" data-ingredient-check="'+i+'"'+(x.verified?' checked':'')+
    ' title="Массы проверены по проработке"></td>'+
    '<td><button type="button" class="btn" data-ingredient-remove="'+i+'" aria-label="Удалить ингредиент">×</button></td>';
  table.appendChild(row);
 });
 table.querySelectorAll('button[data-ingredient-remove]').forEach(el=>el.onclick=()=>{
  const data=readEditor();
  data.ingredients.splice(Number(el.dataset.ingredientRemove),1);
  renderIngredients(data.ingredients);
 });
}
function f(name){return get('ttk305-'+name);}
function val(name){return f(name)?.value||'';}
function readEditor(){
 const data=JSON.parse(JSON.stringify(active.data));
 for(const name of ['title','source_reference','scope','raw_requirements','technology',
     'presentation','storage','quality','safety','nutrition_basis','prepared_by',
     'checked_by','allergen_note','author_note','revision_reason']){
   data[name]=val(name);
 }
 data.kind=val('kind');
 data.output_g=val('output_g');
 data.output_is_estimate=!!f('output_is_estimate').checked;
 data.nutrition_per=val('nutrition_per');
 for(const key of ['protein_g','fat_g','carb_g','kcal'])
   data.nutrition[key]=val(key);
 for(const key of Object.keys(flagNames))
   data.checks[key]=!!f(key).checked;
 const rows=[];
 f('ing-body').querySelectorAll('tr').forEach((row,i)=>{
   rows.push({
    name:row.querySelector('[data-ingredient-name]')?.value||'',
    gross_g:row.querySelector('[data-ingredient-gross]')?.value,
    net_g:row.querySelector('[data-ingredient-net]')?.value,
    verified:!!row.querySelector('[data-ingredient-check]')?.checked
   });
 });
 data.ingredients=rows;
 data.allergens=val('allergens').split(',').map(s=>s.trim()).filter(Boolean);
 return data;
}
function openEditor(card){
 active=card;
 get('ttk305-editor').hidden=false;
 get('ttk305-list-panel').hidden=true;
 const data=card.data||{};
 get('ttk305-editor-name').textContent=card.title+' — '+(card.status==='approved'?'Утверждено в системе':'Черновик');
 const inputs=['title','source_reference','scope','raw_requirements','technology','presentation',
     'storage','quality','safety','nutrition_basis','prepared_by','checked_by',
     'allergen_note','author_note','revision_reason','output_g','nutrition_per'];
 for(const field of inputs)f(field).value=data[field]===undefined?'':data[field];
 f('kind').value=data.kind||'TK';
 f('output_is_estimate').checked=!!data.output_is_estimate;
 f('allergens').value=(data.allergens||[]).join(', ');
 const nutrition=data.nutrition||{};
 for(const key of ['protein_g','fat_g','carb_g','kcal'])
   f(key).value=nutrition[key]===null||nutrition[key]===undefined?'':nutrition[key];
 for(const key of Object.keys(flagNames))f(key).checked=!!data.checks?.[key];
 renderIngredients(data.ingredients||[]);
 get('ttk305-approval-info').textContent=card.status==='approved'?
    'Подтверждено '+card.approved_by+' · '+card.approved_at+
    '. Изменение создаст новую черновую редакцию.':
    ('Перед утверждением необходимо устранить: '+(card.problems||[]).join('; '));
 get('ttk305-approve').disabled=card.status==='approved';
 get('ttk305-save').disabled=false;
 get('ttk305-editor').scrollIntoView({behavior:'smooth',block:'start'});
}
function closeEditor(){
 active=null;get('ttk305-editor').hidden=true;get('ttk305-list-panel').hidden=false;
 load();
}
async function saveCard(){
 if(!active||busy)return;
 busy=true;get('ttk305-save').disabled=true;
 try{
  const r=await act('ttk305_save',{id:active.id,data:readEditor()});
  openEditor(r);toast('Карта сохранена. Изменения фиксируются в истории.');
 }catch(e){toast(e.message);}
 finally{busy=false;get('ttk305-save').disabled=false;}
}
async function approveCard(){
 if(!active||busy)return;
 if(!window.confirm('Я лично проверил рецептуру, технологию, пищевую ценность, условия хранения и источник. Подтвердить утверждение карты в системе? Реальную подпись этот шаг не заменяет.'))return;
 busy=true;
 try{
  // Save before approval, so the approved revision is exactly what is visible.
  const saved=await act('ttk305_save',{id:active.id,data:readEditor()});
  const done=await act('ttk305_approve',{id:saved.id,confirmed:true});
  openEditor(done);toast('В системе зафиксировано утверждение. Подпись в документе оставлена пустой.');
 }catch(e){toast(e.message);}
 finally{busy=false;}
}
function zipBlob(base64){
 const buffers=[];
 for(let i=0;i<base64.length;i+=32768){
  const raw=atob(base64.slice(i,i+32768));
  const chunk=new Uint8Array(raw.length);
  for(let j=0;j<raw.length;j++)chunk[j]=raw.charCodeAt(j);
  buffers.push(chunk);
 }
 return new Blob(buffers,{type:'application/zip'});
}
async function doExport(ids){
 if(!ids.length)return toast('Выберите карты для выгрузки');
 if(ids.length>50)return toast('За один раз можно выгрузить не более 50 карт');
 if(busy)return;
 busy=true;updateSelections();status('Формирую PDF и Word с именами, датами и полями подписей…');
 try{
  const data=await act('ttk305_export',{ids,format:get('ttk305-format').value});
  const blob=zipBlob(data.zip_b64);
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');link.href=url;
  link.download=data.filename||'MoOLVa_TK_TTK.zip';
  document.body.appendChild(link);link.click();link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),30000);
  status('Готово: '+data.count+' карт, из них утверждено в системе: '+
       data.approved+', черновиков: '+data.drafts+'. Уточнённые подписи не генерировались.');
  toast('Карты выгружены в папку загрузок.');
 }catch(e){status('Ошибка выгрузки: '+e.message);toast(e.message);}
 finally{busy=false;updateSelections();}
}
function open(){
 if(!venueReady())return;
 modal.hidden=false;tab='catalog';pageIndex=0;category='';query='';
 f('search').value='';f('category').value='';
 selected.clear();
 get('ttk305-list-panel').hidden=false;get('ttk305-editor').hidden=true;
 load();
}
function close(){
 if(busy)return;
 modal.hidden=true;active=null;
 if(openBtn)openBtn.focus();
}
function install(){
 if(get('ttk305-open'))return;
 const root=get('production-page');
 const head=root?.querySelector('.heading');
 if(!head)return;
 openBtn=button('▤ 617 ТК/ТТК блюд','', 'btn primary');
 openBtn.onclick=open;openBtn.id='ttk305-open';head.appendChild(openBtn);
 modal=document.createElement('div');modal.id='ttk305-modal';modal.className='ttk305-backdrop';
 modal.hidden=true;modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');
 modal.setAttribute('aria-labelledby','ttk305-main-title');
 const textFields=[
 ['source_reference','Источник рецептуры / сборник и №','input'],
 ['scope','Область применения','textarea'],
 ['raw_requirements','Требования к сырью','textarea'],
 ['technology','Технология приготовления','textarea'],
 ['presentation','Оформление и подача','textarea'],
 ['storage','Условия хранения, температура и срок реализации','textarea'],
 ['quality','Показатели качества','textarea'],
 ['safety','Безопасность, температурный контроль','textarea'],
 ['nutrition_basis','Источник расчёта пищевой ценности','input'],
 ['allergen_note','Проверка аллергенов и источник','textarea'],
 ['author_note','Комментарий к проработке','textarea'],
 ['revision_reason','Основание изменений','input']
 ];
 const fieldHtml=textFields.map(([id,label,type])=>
  '<label class="ttk305-field">'+esc(label)+(type==='textarea'?
  '<textarea id="ttk305-'+id+'" rows="2"></textarea>':
  '<input id="ttk305-'+id+'">')+'</label>').join('');
 const checks=Object.entries(flagNames).map(([id,label])=>
  '<label class="ttk305-check"><input id="ttk305-'+id+'" type="checkbox"> '+esc(label)+'</label>').join('');
 modal.innerHTML=
 '<div class="ttk305-window">'+
 '<div class="ttk305-head"><div><h2 id="ttk305-main-title">Технологические карты столовой</h2>'+
 '<p>617 авторских заготовок · ТК и ТТК · PDF, Word, даты и ответственные</p></div>'+
 '<button type="button" class="btn" id="ttk305-close">× Закрыть</button></div>'+
 '<div id="ttk305-list-panel">'+
 '<div class="ttk305-warning">Заготовки не являются нормативным сборником и не утверждены. '+
 'При первом использовании проверьте ингредиенты, массы, технологию, хранение и КБЖУ.</div>'+
 '<div class="ttk305-tabs"><button id="ttk305-catalog-tab" class="btn active">Каталог 617+</button>'+
 '<button id="ttk305-mine-tab" class="btn">Мои технологические карты</button></div>'+
 '<div class="ttk305-filters" id="ttk305-cat-tools">'+
 '<input id="ttk305-search" placeholder="Поиск: борщ, котлета, компот…">'+
 '<select id="ttk305-category"><option value="">Все категории</option>'+
 categories.slice(1).map(c=>'<option value="'+c+'">'+c+'</option>').join('')+
 '</select><button type="button" class="btn" id="ttk305-search-btn">Найти</button></div>'+
 '<div class="ttk305-filters" id="ttk305-mine-tools" hidden>'+
 '<input id="ttk305-mine-search" placeholder="Поиск среди моих карт">'+
 '<button type="button" class="btn" id="ttk305-mine-search-btn">Найти</button>'+
 '<button type="button" class="btn" id="ttk305-new">+ Своя карта</button></div>'+
 '<div class="ttk305-list" id="ttk305-items"></div>'+
 '<div class="ttk305-pages"><button type="button" class="btn" id="ttk305-prev">← Назад</button>'+
 '<span id="ttk305-count"></span><button type="button" class="btn" id="ttk305-next">Далее →</button></div>'+
 '<div class="ttk305-export"><span id="ttk305-selected">0 выбрано</span>'+
 '<select id="ttk305-format"><option value="both">PDF + Word</option><option value="pdf">Только PDF</option>'+
 '<option value="docx">Только Word</option></select><button type="button" class="btn primary" id="ttk305-export">↓ Выгрузить выбранные</button></div>'+
 '</div>'+
 '<div id="ttk305-editor" hidden><div class="ttk305-editor-head"><h3 id="ttk305-editor-name">Карта</h3>'+
 '<button type="button" class="btn" id="ttk305-back">← К списку</button></div>'+
 '<p class="ttk305-warning">Проверяйте реальные данные. ФИО выбирается из сотрудников предприятия; '+
 'выгрузка не создаёт электронных подписей.</p>'+
 '<div class="ttk305-editgrid"><label class="ttk305-field">Название блюда<input id="ttk305-title"></label>'+
 '<label class="ttk305-field">Тип документа<select id="ttk305-kind"><option value="TK">ТК — традиционное блюдо</option>'+
 '<option value="TTK">ТТК — новая продукция</option></select></label>'+
 '<label class="ttk305-field">Выход, г<input type="number" id="ttk305-output_g" min="1"></label>'+
 '<label class="ttk305-check"><input type="checkbox" id="ttk305-output_is_estimate"> Выход пока предварительный</label>'+
 '<label class="ttk305-field">ФИО составителя<input id="ttk305-prepared_by" placeholder="ФИО составителя"></label>'+
 '<label class="ttk305-field">ФИО проверяющего<input id="ttk305-checked_by" placeholder="ФИО проверяющего"></label></div>'+
 '<h3>Рецептура на порцию · брутто / нетто, г</h3>'+
 '<div class="ttk305-tablewrap"><table class="ttk305-table"><thead><tr>'+
 '<th>Ингредиент</th><th>Брутто, г</th><th>Нетто, г</th><th>Проверено</th><th></th>'+
 '</tr></thead><tbody id="ttk305-ing-body"></tbody></table></div>'+
 '<button type="button" class="btn" id="ttk305-add-ing">+ Добавить ингредиент</button>'+
 '<div class="ttk305-editgrid">'+fieldHtml+'</div>'+
 '<h3>Пищевая ценность</h3><div class="ttk305-editgrid">'+
 '<label class="ttk305-field">Белки, г<input type="number" step=".01" min="0" id="ttk305-protein_g"></label>'+
 '<label class="ttk305-field">Жиры, г<input type="number" step=".01" min="0" id="ttk305-fat_g"></label>'+
 '<label class="ttk305-field">Углеводы, г<input type="number" step=".01" min="0" id="ttk305-carb_g"></label>'+
 '<label class="ttk305-field">Калорийность, ккал<input type="number" step=".01" min="0" id="ttk305-kcal"></label>'+
 '<label class="ttk305-field">Расчёт<select id="ttk305-nutrition_per"><option value="на порцию">На порцию</option>'+
 '<option value="на 100 г">На 100 г</option></select></label>'+
 '<label class="ttk305-field">Аллергены (через запятую)<input id="ttk305-allergens"></label></div>'+
 '<h3>Проверка перед утверждением</h3><div class="ttk305-editgrid">'+checks+'</div>'+
 '<p class="ttk305-muted" id="ttk305-approval-info"></p>'+
 '<div class="ttk305-actions"><button type="button" class="btn" id="ttk305-save">Сохранить черновик</button>'+
 '<button type="button" class="btn primary" id="ttk305-approve">Утвердить в системе</button>'+
 '<button type="button" class="btn" id="ttk305-export-one">↓ PDF / Word</button></div>'+
 '</div><div id="ttk305-status" class="ttk305-status" aria-live="polite"></div></div>';
 document.body.appendChild(modal);
 get('ttk305-close').onclick=close;
 modal.addEventListener('click',e=>{if(e.target===modal)close();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden&&!busy){close();}});
 get('ttk305-catalog-tab').onclick=()=>{tab='catalog';pageIndex=0;selected.clear();load();};
 get('ttk305-mine-tab').onclick=()=>{tab='mine';pageIndex=0;selected.clear();load();};
 get('ttk305-search-btn').onclick=()=>{query=f('search').value.trim();category=f('category').value;pageIndex=0;load();};
 get('ttk305-mine-search-btn').onclick=()=>{pageIndex=0;load();};
 get('ttk305-prev').onclick=()=>{pageIndex=Math.max(0,pageIndex-1);load();};
 get('ttk305-next').onclick=()=>{pageIndex++;load();};
 get('ttk305-back').onclick=closeEditor;
 get('ttk305-save').onclick=saveCard;
 get('ttk305-approve').onclick=approveCard;
 get('ttk305-export-one').onclick=()=>{if(active)doExport([active.id]);};
 get('ttk305-export').onclick=()=>doExport([...selected]);
 get('ttk305-add-ing').onclick=()=>{
  if(!active)return;
  const data=readEditor();data.ingredients.push({name:'',gross_g:1,net_g:1,verified:false});
  renderIngredients(data.ingredients);
 };
 get('ttk305-new').onclick=async()=>{
  try{const r=await act('ttk305_new',{});openEditor(r);}
  catch(e){toast(e.message);}
 };
 const css=document.createElement('style');
 css.textContent='.ttk305-backdrop{position:fixed;inset:0;background:#071121dc;z-index:121000;display:flex;align-items:center;justify-content:center;padding:12px}.ttk305-backdrop[hidden]{display:none}.ttk305-window{width:min(1100px,100%);max-height:95vh;overflow:auto;background:#1c2d4a;color:#eef6ff;border:1px solid #526a94;border-radius:17px;padding:19px;box-shadow:0 24px 68px #000a}.ttk305-head,.ttk305-tabs,.ttk305-filters,.ttk305-pages,.ttk305-export,.ttk305-editor-head,.ttk305-actions{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}.ttk305-head h2{margin:0}.ttk305-head p,.ttk305-muted{color:#b4c5e2;font-size:12px;line-height:1.6}.ttk305-tabs{justify-content:start;margin:14px 0}.ttk305-tabs .active{background:#426d83}.ttk305-warning{padding:12px;background:#52452d;border-left:3px solid #ecb960;color:#fff1cd;font-size:12px;line-height:1.6;border-radius:6px;margin:13px 0}.ttk305-filters input,.ttk305-filters select,.ttk305-export select,.ttk305-field input,.ttk305-field select,.ttk305-field textarea{min-height:41px;background:#233953;color:#fff;border:1px solid #5b7196;border-radius:9px;padding:9px;box-sizing:border-box}.ttk305-filters input{flex:1;min-width:170px}.ttk305-list{border:1px solid #445a7c;border-radius:11px;padding:8px;max-height:43vh;min-height:170px;overflow:auto}.ttk305-item{display:flex;align-items:center;gap:12px;padding:11px;border-bottom:1px solid #3c506f}.ttk305-item-text{flex:1;min-width:0;display:grid;gap:5px}.ttk305-item-text b{font-size:13px}.ttk305-item-text small{font-size:11px;color:#afc6df}.ttk305-item>input{accent-color:#5ce2ae;width:18px;height:18px}.ttk305-pages{margin:12px 0}.ttk305-export{background:#293e61;padding:12px;border-radius:10px}.ttk305-status{margin:12px 0;font-size:12px;line-height:1.6;color:#d3e4f8}.ttk305-editgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:11px}.ttk305-field{display:grid;gap:6px;font-size:12px;color:#cadbef}.ttk305-field textarea{min-height:85px;width:100%}.ttk305-tablewrap{overflow:auto;margin:12px 0}.ttk305-table{border-collapse:collapse;width:100%;min-width:610px;font-size:12px}.ttk305-table td,.ttk305-table th{padding:8px;border:1px solid #455b7d}.ttk305-table input{max-width:100%;width:100%;box-sizing:border-box;background:#263b58;border:1px solid #58749c;border-radius:6px;padding:7px;color:#fff}.ttk305-table td:first-child{width:48%}.ttk305-table input[type=checkbox]{width:20px;height:20px;accent-color:#5ce2ae}.ttk305-check{display:flex;gap:9px;align-items:center;font-size:12px;background:#263b57;padding:9px;border-radius:9px}.ttk305-check input{accent-color:#56dfac;width:18px;height:18px;flex-shrink:0}.ttk305-editor-head{margin:12px 0}.ttk305-actions{margin:16px 0}.ttk305-window h3{font-size:16px;margin:18px 0 10px}@media(max-width:650px){.ttk305-window{padding:11px}.ttk305-item{flex-wrap:wrap}.ttk305-item .btn{flex:1}.ttk305-export .btn{width:100%}.ttk305-tabs .btn{flex:1}}';
 document.head.appendChild(css);
 updateSelections();
}
window.MoOLVaTTK305={open,load};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
else install();
})();