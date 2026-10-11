/* MoOLVa 3.0.2 — a shared employee selector across all employee-name fields.
   Suggestions are sourced only from staff of the CURRENT selected enterprise.
   User selection never signs records or confirms any checks. */
(function () {
  'use strict';
  const FLAG = 'moolvaStaff302';
  const relevant = /(фио|ф[. ]*и[. ]*о|сотрудник|ответственн|исполнител|работник|передающ|получател|принял смену|передал смену|заместител|personnel|responsible|employee|staff|owner|actor|recipient|sender|deputy|fio|full.?name)/i;
  const exclusions = /(подпис|подтверждени|парол|логин|электронн.*почт|email|паспорт|инн|снилс|телефон|номер договора|штрихкод)/i;
  let panel = null;
  let inputActive = null;
  let openingButton = null;
  let observer = null;
  let renderQueued = false;

  function appState() {
    try { return typeof state === 'object' && state ? state : null; }
    catch (_) { return null; }
  }
  function people() {
    const s = appState();
    if (!s || !s.venue) return [];
    const staff23 = Array.isArray(s.employees23) ? s.employees23 : [];
    const staff222 = Array.isArray(s.employees222) ? s.employees222 : [];
    const unique = new Set();
    return [...staff23, ...staff222].map(person => {
      if (typeof person === 'string') return {name: person.trim(), position: ''};
      const p = person || {};
      return {name: String(p.name || p.fio || p.full_name || '').trim(),
              position: String(p.position || p.role_title || '').trim(),
              archived: !!(p.archived || p.deleted)};
    }).filter(p => {
      if (!p.name || p.archived || unique.has(p.name.toLocaleLowerCase('ru'))) return false;
      unique.add(p.name.toLocaleLowerCase('ru'));
      return true;
    });
  }
  function isNameField(el) {
    if (!el || String(el.tagName).toUpperCase() !== 'INPUT') return false;
    const type = String(el.type || 'text').toLowerCase();
    if (!['text','search'].includes(type) || el.disabled || el.readOnly) return false;
    const parent = el.closest && el.closest('.formfield,.inv-field,.o22-field,.e30-fields,.c24-grid,.o22-employee,label');
    const label = el.labels ? Array.from(el.labels).map(x=>x.textContent||'').join(' ') : '';
    const parentLabel = parent && parent.querySelector && parent.querySelector('label');
    const hint = [
      el.id, el.name, el.placeholder, el.getAttribute('aria-label'),
      el.getAttribute('title'),label, parentLabel && parentLabel.textContent,
      el.getAttribute('data-o22')
    ].filter(Boolean).join(' ');
    // Never suggest a name for a real signature or unrelated data field.
    if (exclusions.test(hint)) return false;
    return relevant.test(hint) ||
      (el.getAttribute('data-o22') === 'name' && !!el.closest('.o22-employee'));
  }
  function html(s) {
    return String(s==null?'':s).replace(/[&<>"']/g,c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }
  function hide() {
    if (panel) {panel.hidden = true; panel.innerHTML = '';}
    if (openingButton) openingButton.setAttribute('aria-expanded','false');
    inputActive = null;
    openingButton = null;
  }
  function reposition() {
    if (!panel || panel.hidden || !inputActive) return;
    const r = inputActive.getBoundingClientRect();
    const maxHeight = Math.min(310, Math.max(165,window.innerHeight * .42));
    panel.style.maxHeight = maxHeight + 'px';
    const down = window.innerHeight - r.bottom;
    const up = r.top;
    panel.style.left = Math.max(8,Math.min(r.left,window.innerWidth - Math.max(220,r.width) - 8)) + 'px';
    panel.style.width = Math.max(220,Math.min(window.innerWidth - 16, r.width + 70))+'px';
    if (down > 190 || down >= up) {panel.style.top=(r.bottom+5)+'px';panel.style.bottom='auto';}
    else {panel.style.top='auto';panel.style.bottom=(window.innerHeight-r.top+5)+'px';}
  }
  function renderChoices(query, showAll) {
    if (!panel || !inputActive) return;
    const all = people();
    let filtered = all;
    if (!showAll && query && query.trim()) {
      const q=query.trim().toLocaleLowerCase('ru');
      filtered=all.filter(p=>(p.name+' '+p.position).toLocaleLowerCase('ru').includes(q));
    }
    panel.innerHTML = '<div class="staff302-head">Выберите сотрудника <small>из списка предприятия</small></div>';
    if (!all.length) {
      const line=document.createElement('div');
      line.className='staff302-empty';
      line.textContent='Список пуст. Сначала добавьте сотрудников в карточке предприятия.';
      panel.appendChild(line);
    } else if (!filtered.length) {
      const line=document.createElement('div');
      line.className='staff302-empty';
      line.textContent='Совпадений нет. Очистите поле, чтобы увидеть весь список.';
      panel.appendChild(line);
    }
    filtered.slice(0,80).forEach(person=>{
      const item=document.createElement('button');
      item.type='button';
      item.className='staff302-option';
      item.setAttribute('role','option');
      const primary=document.createElement('span');
      primary.textContent=person.name;
      item.appendChild(primary);
      if (person.position) {
        const secondary=document.createElement('small');
        secondary.textContent=person.position;
        item.appendChild(secondary);
      }
      item.addEventListener('mousedown',e=>e.preventDefault());
      item.addEventListener('click',()=>{
        const input=inputActive;
        hide();
        if (!input || !input.isConnected) return;
        input.value=person.name;
        input.dispatchEvent(new Event('input',{bubbles:true}));
        input.dispatchEvent(new Event('change',{bubbles:true}));
        input.focus();
      });
      panel.appendChild(item);
    });
    reposition();
  }
  function show(el, showAll) {
    if (!people().length) {
      // A visible button still explains how to enable this feature.
      if (typeof toast==='function') toast('Сотрудники ещё не добавлены в выбранное предприятие');
      return;
    }
    const other = inputActive;
    if (other && other !== el) hide();
    inputActive=el;
    openingButton=el.nextElementSibling?.classList?.contains('staff302-trigger')
      ? el.nextElementSibling : null;
    if (openingButton) openingButton.setAttribute('aria-expanded','true');
    panel.hidden=false;
    renderChoices(el.value, !!showAll);
  }
  function decorate(el) {
    if (el.dataset[FLAG] || !isNameField(el)) return;
    el.dataset[FLAG]='yes';
    el.setAttribute('autocomplete','off');
    const button=document.createElement('button');
    button.type='button';
    button.className='staff302-trigger';
    button.setAttribute('aria-label','Выбрать ФИО из сотрудников предприятия');
    button.setAttribute('aria-expanded','false');
    button.setAttribute('aria-haspopup','listbox');
    button.setAttribute('title','Показать сотрудников предприятия');
    button.textContent='▾ ФИО из списка';
    el.insertAdjacentElement('afterend',button);
    button.addEventListener('click',()=>{
      if (inputActive === el && !panel.hidden) hide();
      else show(el,true);
    });
    el.addEventListener('input',()=>{
      if (inputActive === el && !panel.hidden) renderChoices(el.value,false);
    });
    el.addEventListener('focus',()=>{
      if (people().length) show(el, false);
    });
  }
  function scan() {
    renderQueued=false;
    const s=appState();
    if (!s || !s.venue || !document.body) return;
    document.querySelectorAll('input:not([data-moolva-staff302])').forEach(decorate);
    if (inputActive && (!inputActive.isConnected || !isNameField(inputActive))) hide();
  }
  function scheduleScan() {
    if (renderQueued) return;
    renderQueued=true;
    window.requestAnimationFrame(scan);
  }
  function install() {
    if (panel || !document.body) return;
    const style=document.createElement('style');
    style.textContent='.staff302-trigger{display:inline-flex;align-items:center;justify-content:center;margin:5px 0 5px 7px;border:1px solid #55739e;border-radius:9px;padding:7px 11px;color:#d7edff;background:#223b5f;font-size:12px;line-height:1.3;cursor:pointer;white-space:nowrap}.staff302-trigger:hover,.staff302-trigger:focus-visible{background:#37567b;outline:2px solid #7dc9e2;outline-offset:1px}.staff302-panel{position:fixed;z-index:99999;min-width:220px;overflow-y:auto;border:1px solid #6b85b2;border-radius:12px;background:#1b2c47;box-shadow:0 15px 48px rgba(0,0,0,.5);color:#fff;padding:7px}.staff302-panel[hidden]{display:none}.staff302-head{font-size:13px;font-weight:750;padding:9px 10px;color:#c9e6ff;position:sticky;top:0;background:#1b2c47}.staff302-head small{display:block;font-size:11px;font-weight:400;color:#a9bbd8;margin-top:2px}.staff302-empty{color:#c0cadb;padding:12px;font-size:13px}.staff302-option{display:flex;flex-direction:column;align-items:flex-start;gap:2px;width:100%;color:#fff;background:transparent;border:0;border-radius:7px;padding:12px 10px;cursor:pointer;text-align:left;font-size:14px}.staff302-option small{font-size:11px;color:#b8cbe6}.staff302-option:hover,.staff302-option:focus-visible{background:#314c74;outline:none}@media(max-width:640px){.staff302-trigger{font-size:12px;padding:9px}.staff302-panel{max-width:calc(100vw - 16px)}}';
    document.head.appendChild(style);
    panel=document.createElement('div');
    panel.className='staff302-panel';
    panel.hidden=true;
    panel.setAttribute('role','listbox');
    panel.id='moolva-staff302-options';
    document.body.appendChild(panel);
    document.addEventListener('pointerdown',e=>{
      if (panel && !panel.hidden && !panel.contains(e.target) &&
        e.target !== inputActive && e.target !== openingButton) hide();
    });
    document.addEventListener('keydown',e=>{
      if (!panel || panel.hidden) return;
      if (e.key==='Escape') {hide();return;}
      if (e.key==='ArrowDown' && e.target===inputActive) {
        e.preventDefault();
        const first=panel.querySelector('.staff302-option');
        if(first)first.focus();
      }
    });
    window.addEventListener('scroll',reposition,true);
    window.addEventListener('resize',reposition);
    document.addEventListener('focusin',e=>{
      const el=e.target;
      if (isNameField(el) && !el.dataset[FLAG]) decorate(el);
    });
    observer=new MutationObserver(records=>{
      if(records.some(r=>Array.from(r.addedNodes).some(n=>
          n.nodeType===1 && (n.tagName==='INPUT' || n.querySelector?.('input'))))) {
        scheduleScan();
      }
    });
    observer.observe(document.body,{childList:true,subtree:true});
    scheduleScan();
  }
  // Safe diagnostics for UI regression tests; never writes records or signs.
  window.MoOLVaStaffPicker302={people,isNameField,refresh:scheduleScan};
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();