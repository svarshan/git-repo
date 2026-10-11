(function(){
  'use strict';
  if (typeof ROUTES22 === 'undefined' || !document.getElementById('navigation')) return;
  if (!ROUTES22.includes('enterprise30')) ROUTES22.push('enterprise30');
  var nav=document.getElementById('navigation');
  var btn=document.createElement('button');
  btn.dataset.page='enterprise30';
  btn.innerHTML='<span class="ico">✦</span>Рабочий день 3.0';
  btn.addEventListener('click',function(){page('enterprise30');loadEnterprise30();});
  nav.insertBefore(btn,nav.firstElementChild);
  var style=document.createElement('style');
  style.textContent='.e30-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:12px;margin:14px 0}.e30-panel{background:#202f50;border:1px solid #395179;border-radius:14px;padding:18px}.e30-panel h2{font-size:16px;margin:0 0 12px}.e30-panel small{color:#bac9e4}.e30-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.e30-actions .btn{white-space:normal}.e30-row{padding:12px 4px;border-bottom:1px solid #40516c;display:flex;align-items:center;justify-content:space-between;gap:10px}.e30-row:last-child{border:0}.e30-row p{margin:4px 0}.e30-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));gap:12px}.e30-fields label{display:grid;gap:6px;color:#b9cae6}.e30-fields input,.e30-fields select,.e30-fields textarea,#e30-question,#e30-search{min-width:0;width:100%;color:#fff;background:#152647;border:1px solid #556b91;border-radius:9px;padding:11px}.e30-note{font-size:12px;color:#aebfe0;line-height:1.6}.e30-highlight{color:#58e0b2}.e30-scroll{max-height:350px;overflow:auto}@media(max-width:600px){.e30-row{flex-wrap:wrap}.e30-actions .btn{flex:1 1 140px}}';
  document.head.appendChild(style);
  var container=document.createElement('section');
  container.id='enterprise30-page';
  container.className='hide';
  container.hidden=true;
  container.setAttribute('aria-label','Рабочий день Enterprise 3.0');
  container.innerHTML=
    '<div class="heading"><div><h1>Мой рабочий день · Enterprise 3.0</h1><p class="muted">Один компьютер · локальная база · задачи без вымышленных измерений</p></div><button class="btn" onclick="loadEnterprise30()">↻ Обновить</button></div>'+
    '<div class="e30-panel"><div class="e30-fields"><label>Рабочее место сотрудника<select id="e30-person" onchange="loadEnterprise30()"><option value="">Общий план смены</option></select></label><label>Поиск по журналам, документам и сотрудникам<input id="e30-search" placeholder="Например: холодильник" aria-label="Поиск"></label></div><div class="e30-actions"><button class="btn" onclick="searchEnterprise30()">Найти</button><button class="btn" onclick="openCreateVenue()">Мастер предприятия</button><button class="btn" onclick="page(\'journals\')">Мои журналы</button><button class="btn" onclick="page(\'inventory\')">Склад и партии</button><button class="btn" onclick="page(\'production\')">ТТК и меню</button><button class="btn" onclick="page(\'control24\')">Контроль отклонений</button><button class="btn" onclick="page(\'documents\')">Документы</button><button class="btn" onclick="page(\'equipment\')">Оборудование</button></div><div id="e30-search-result" class="e30-note"></div></div>'+
    '<div class="e30-grid" id="e30-stats"><div class="e30-panel">Загружаю реальные данные…</div></div>'+
    '<div class="e30-grid"><div class="e30-panel"><h2>Задачи на смену</h2><div id="e30-tasks" class="e30-scroll"></div></div><div class="e30-panel"><h2>Запланированные проверки</h2><div id="e30-plans" class="e30-scroll"></div></div></div>'+
    '<div class="e30-panel" style="margin-bottom:14px"><h2>Умные журналы: создать план рабочих дней</h2><p class="e30-note">План не содержит измерений, подписей или отметок о выполнении. Суббота и воскресенье пропускаются.</p><div class="e30-fields"><label>Журнал<select id="e30-journal"></select></label><label>С какой даты<input id="e30-start" type="date"></label><label>Количество рабочих дней<input id="e30-count" type="number" min="1" max="31" value="5"></label><label>Ответственный<input id="e30-owner" placeholder="ФИО сотрудника"></label></div><div class="e30-actions"><button class="btn primary" onclick="planEnterprise30()">Создать плановые строки</button></div></div>'+
    '<div class="e30-grid"><div class="e30-panel"><h2>Передача смены</h2><div class="e30-fields"><label>Передающий<input id="e30-sender" placeholder="ФИО"></label><label>Получатель<input id="e30-recipient" placeholder="ФИО (необязательно)"></label></div><textarea id="e30-message" rows="3" placeholder="Что осталось проверить, какие задачи требуют внимания" style="margin-top:10px;width:100%;color:#fff;background:#152647;border:1px solid #556b91;border-radius:9px;padding:10px"></textarea><div class="e30-actions"><button class="btn primary" onclick="saveEnterprise30Handover()">Сохранить передачу</button></div><div id="e30-handovers"></div></div>'+
    '<div class="e30-panel"><h2>Учебный помощник новичка</h2><p class="e30-note">«Прочитано» означает ознакомление, не факт выполнения работ.</p><div id="e30-training"></div></div></div>'+
    '<div class="e30-grid"><div class="e30-panel"><h2>Помощник MoOLVa (локальный)</h2><input id="e30-question" placeholder="Например: как заполнить журнал холодильника?"><div class="e30-actions"><button class="btn primary" onclick="askEnterprise30()">Получить подсказку</button></div><div id="e30-answer" class="e30-note">Без интернета и выдуманных показаний.</div></div><div class="e30-panel"><h2>Диагностика и аудит</h2><div class="e30-actions"><button class="btn" onclick="diagnoseEnterprise30()">Проверить базу данных</button><button class="btn" onclick="page(\'audit\')">История действий</button><button class="btn" onclick="page(\'settings\')">Резервное копирование</button></div><div id="e30-health" class="e30-note">Проверка ничего не изменяет.</div></div></div>';
  var main=document.querySelector('.main-shell main');
  if(main)main.appendChild(container);
  function el(id){return document.getElementById(id);}
  function escapeValue(v){return String(v===null||v===undefined?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function label(v){return escapeValue(v||'—');}
  var loadedFor=0;
  window.loadEnterprise30=async function(){
    if(!state.venue)return;
    try{
      var persons=state.employees23||[];
      var personEl=el('e30-person');
      var name=personEl.value;
      personEl.innerHTML='<option value="">Общий план смены</option>'+persons.map(function(p){return '<option value="'+escapeValue(p.name)+'">'+label(p.name)+' — '+label(p.position)+'</option>';}).join('');
      personEl.value=persons.some(function(p){return p.name===name;})?name:'';
      if(!el('e30-start').value)el('e30-start').value=new Date().toLocaleDateString('en-CA');
      var journals=(state.schedules||[]).filter(function(x){return x.active!==false;});
      el('e30-journal').innerHTML=journals.map(function(j){return '<option value="'+label(j.journal_key)+'">'+label(j.title)+'</option>';}).join('');
      if(!el('e30-owner').value)el('e30-owner').value=personEl.value||(currentAccount&&currentAccount.display_name)||'';
      var data=await act('enterprise30_board',{employee:personEl.value});
      loadedFor=state.venue;
      el('e30-stats').innerHTML=[
        ['Журналов по графику',data.total_schedules],
        ['Заполнено в периоде',data.completed_schedules],
        ['Просроченные задачи',data.overdue],
        ['Плановые строки',data.planned.length]
      ].map(function(i){return '<div class="e30-panel"><strong style="display:block;font-size:28px;color:#4bf1ac">'+label(i[1])+'</strong><small>'+label(i[0])+'</small></div>';}).join('');
      el('e30-tasks').innerHTML=(data.tasks||[]).map(function(t){
        var code=String(t.journal_key||'').replace(/^legacy:/,'');
        var action=code&&state.templates.some(function(x){return x.code===code;})?
           '<button class="btn" data-code="'+escapeValue(code)+'">Заполнить</button>':'<button class="btn" data-goto="equipment">Оборудование</button>';
        return '<div class="e30-row"><div><b>'+label(t.title)+'</b><p class="e30-note">'+label(t.owner)+' · '+label(t.due)+' · '+label(t.stage)+'</p></div>'+action+'</div>';
      }).join('')||'<p class="e30-note">Нет задач на ближайшую смену. Проверьте настройки графиков.</p>';
      el('e30-tasks').querySelectorAll('button[data-code]').forEach(function(b){b.onclick=function(){startWizard(b.dataset.code);};});
      el('e30-tasks').querySelectorAll('button[data-goto]').forEach(function(b){b.onclick=function(){page('equipment');};});
      el('e30-plans').innerHTML=(data.planned||[]).map(function(p){return '<div class="e30-row"><span>'+label(p.planned_for)+' · '+label(p.journal_key)+'<p class="e30-note">'+label(p.responsible)+'</p></span><span class="e30-note">План</span></div>';}).join('')||'<p class="e30-note">Нет запланированных строк.</p>';
      el('e30-handovers').innerHTML=(data.handovers||[]).map(function(h){return '<div class="e30-row"><div><b>'+label(h.sender)+'</b> → '+label(h.recipient)+'<p>'+label(h.note)+'</p><small>'+label(h.created_at)+'</small></div></div>';}).join('')||'<p class="e30-note">Передач смены пока нет.</p>';
      var t=await act('enterprise30_training');
      el('e30-training').innerHTML=(t.items||[]).map(function(x){return '<div class="e30-row"><div><b>'+label(x.name)+'</b><p class="e30-note">'+label(x.help)+'</p></div>'+(x.read?'<span class="e30-highlight">Прочитано</span>':'<button class="btn" data-learn="'+escapeValue(x.key)+'">Прочитано</button>')+'</div>';}).join('');
      el('e30-training').querySelectorAll('button[data-learn]').forEach(function(b){b.onclick=function(){ackEnterprise30(b.dataset.learn);};});
    }catch(e){toast('Enterprise 3.0: '+e.message);}
  };
  window.planEnterprise30=async function(){
    try{
      var r=await act('enterprise30_plan',{journal_key:el('e30-journal').value,start_on:el('e30-start').value,count:Number(el('e30-count').value),owner:el('e30-owner').value});
      toast('Создано плановых строк: '+r.created+'. Результаты проверок не генерировались.');await loadEnterprise30();
    }catch(e){toast(e.message);}
  };
  window.saveEnterprise30Handover=async function(){
    try{
      await act('enterprise30_handover',{sender:el('e30-sender').value,recipient:el('e30-recipient').value,note:el('e30-message').value});
      el('e30-message').value='';await loadEnterprise30();toast('Сообщение о передаче смены сохранено');
    }catch(e){toast(e.message);}
  };
  window.ackEnterprise30=async function(key){
    try{await act('enterprise30_training_ack',{key:key});await loadEnterprise30();}catch(e){toast(e.message);}
  };
  window.askEnterprise30=async function(){
    try{var r=await act('enterprise30_assistant',{question:el('e30-question').value});
      el('e30-answer').textContent=r.answer+' '+r.disclaimer;}catch(e){toast(e.message);}
  };
  window.searchEnterprise30=async function(){
    try{var r=await act('enterprise30_search',{query:el('e30-search').value});
      el('e30-search-result').innerHTML=(r.items||[]).map(function(x){return '<button class="btn" data-go="'+escapeValue(x.destination)+'">'+label(x.type)+': '+label(x.title)+'</button>';}).join(' ')||'Ничего не найдено';
      el('e30-search-result').querySelectorAll('button[data-go]').forEach(function(b){b.onclick=function(){page(b.dataset.go);};});
    }catch(e){toast(e.message);}
  };
  window.diagnoseEnterprise30=async function(){
    try{var r=await act('enterprise30_health');
      el('e30-health').textContent='База: '+r.database_integrity+' · Фактических записей: '+r.records+' · Событий аудита: '+r.audit_events+' · Проверено: '+r.checked_at;
    }catch(e){toast(e.message);}
  };
})();