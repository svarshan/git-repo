'use strict';
/* MoOLVa 7.6: reversible sidebar with accessible native accordions; user state stored separately from historic settings and diary. */
(function(){
 const key='ptitsy-nn.sidebar.v76',body=document.body;
 const button=document.getElementById('m76Toggle'),options=document.getElementById('m76SidebarCompact');
 const groups=[...document.querySelectorAll('aside.sidebar .m76-nav-group')];
 let state={collapsed:false,find:false,library:false};
 try{
  const saved=JSON.parse(localStorage.getItem(key)||'null');
  if(saved&&typeof saved==='object'&&!Array.isArray(saved)){
   for(const field of Object.keys(state))if(typeof saved[field]==='boolean')state[field]=saved[field];
  }
 }catch{}
 function save(){try{localStorage.setItem(key,JSON.stringify(state));}catch{}}
 function paint(){
  body.classList.toggle('m76-sidebar-compact',state.collapsed);
  if(options)options.checked=state.collapsed;
  if(button){
   button.setAttribute('aria-expanded',String(!state.collapsed));
   button.setAttribute('aria-label',state.collapsed?'Развернуть боковое меню':'Свернуть боковое меню');
   button.title=state.collapsed?'Развернуть меню':'Свернуть меню';
   button.textContent=state.collapsed?'☰':'«';
  }
 }
 function expand(){if(state.collapsed){state.collapsed=false;paint();save();}}
 const mode=window.matchMedia?.('(max-width:760px)');
 function setCollapsed(next){
  state.collapsed=Boolean(next);
  // On narrow windows the menu is a horizontal scroller, not an icon strip.
  if(mode?.matches)state.collapsed=false;
  paint();save();
 }
 button?.addEventListener('click',()=>setCollapsed(!state.collapsed));
 options?.addEventListener('change',()=>setCollapsed(options.checked));
 for(const group of groups){
  const id=group.id==='m76-find'?'find':'library';
  group.open=state[id];
  group.addEventListener('toggle',()=>{state[id]=group.open;save();});
  const summary=group.querySelector('summary');
  summary?.addEventListener('click',e=>{
   if(state.collapsed){e.preventDefault();expand();group.open=true;state[id]=true;save();}
  });
 }
 // External navigation (cards, hotkeys) must reveal the selected button in its group.
 document.addEventListener('click',e=>{
  const target=e.target.closest?.('[data-view],[data-page]');
  if(!target)return;
  const view=target.dataset.view||target.dataset.page;
  const nested=groups.find(group=>group.querySelector('button[data-view="'+view+'"]'));
  if(nested&&!nested.open){nested.open=true;}
 });
 window.addEventListener('resize',()=>{if(mode?.matches&&state.collapsed)setCollapsed(false);});
 paint();
})();
