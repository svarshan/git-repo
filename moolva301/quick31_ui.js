/* MoOLVa 3.0.1 Smart Journals — one screen, no fictional observations. */
(function(){
'use strict';
let serial=0, context=null, selectedProfile=0, editing=false, sending=false;
let requestKey='';
const $q=id=>document.getElementById(id);
const escQ=v=>String(v===undefined||v===null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function makeRequestKey(){
  if(window.crypto&&crypto.randomUUID)return crypto.randomUUID();
  return String(Date.now())+'-'+String(Math.random()).slice(2);
}
function existingTemplate(){return (state.templates||[]).find(t=>t.code===selectedCode);}
function employees(){return (state.employees23||[]).filter(e=>e&&e.name);}
function profileStorageKey(){return 'moolva_quick_profile_'+state.venue+'_'+selectedCode;}
function disabled(yes){let btn=$q('wizard-next');if(btn)btn.disabled=!!yes;}
function setMessage(s){let area=$q('quick31-help');if(area)area.textContent=s;}
function showProfiles(){
  let profiles=context.profiles||[];
  let last=Number(localStorage.getItem(profileStorageKey())||'0');
  if(!profiles.some(p=>p.id===selectedProfile))selectedProfile=profiles.some(p=>p.id===last)?last:(profiles[0]?.id||0);
  if(!selectedProfile)editing=true;
}
function profile(){return (context?.profiles||[]).find(x=>x.id===selectedProfile);}
function clockLabel(){
  return new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium',timeStyle:'short'}).format(new Date());
}
function render(){
  if(!context||!$q('wizard-fields'))return;
  showProfiles();
  let p=profile(),t=existingTemplate(),cols=context.columns||[];
  let choose='<div class="formfield"><label>Журнал</label><select id="quick31-code" onchange="quick31ChangeJournal(this.value)">'+
       (state.templates||[]).map(x=>'<option value="'+escQ(x.code)+'" '+(x.code===selectedCode?'selected':'')+'>'+escQ(x.name)+'</option>').join('')+
       '</select></div>';
  let profiles='<div class="formfield"><label>Оборудование и постоянные реквизиты</label><select id="quick31-profile" onchange="quick31SelectProfile(this.value)">'+
    (context.profiles||[]).map(x=>'<option value="'+x.id+'" '+(x.id===selectedProfile?'selected':'')+'>'+escQ(x.title)+'</option>').join('')+
    '<option value="0" '+(!selectedProfile?'selected':'')+'>+ Создать новый объект / журнал</option></select></div>';
  $q('wizard-title').textContent=t?.name||'Журнал';
  $q('wizard-subtitle').textContent='Одно окно вместо 6 шагов · постоянные данные сохраняются один раз';
  $q('wizard-hint').textContent='Укажите реальные показатели. Дата и время регистрации проставятся автоматически в момент сохранения.';
  $q('wizard-steps').innerHTML='<div class="step active"><span class="step-dot">✓</span><span><b>Всё на одном экране</b><small>Выберите объект → введите фактический показатель → сохраните</small></span></div>';
  let html='<div class="quick31-layout">'+choose+profiles;
  if(editing||!p){
    html+='<div class="quick31-heading">Постоянные данные (настроить один раз)</div><div class="formgrid">';
    // Name is derived from equipment; novice never needs to invent a preset title.
    html+='<div class="quick31-simple-tip">Настройте один раз. В дальнейшем понадобится только новое измерение.</div>';
    const assets=(state.assets||[]).filter(x=>x&&x.display_name);
    const matchAsset=assets.length===1?assets[0]:null;
    const presetEquipment=p?.equipment||(matchAsset?.display_name||'');
    const presetZone=p?.zone||(matchAsset?.location||'');
    html+='<div class="formfield"><label>Оборудование / объект *</label><input id="q31-equipment" list="q31-assets" value="'+escQ(presetEquipment)+'" maxlength="200" placeholder="Выберите оборудование" onchange="quick31AssetSelected(this.value)">'+
       '<datalist id="q31-assets">'+assets.map(x=>'<option value="'+escQ(x.display_name)+'"></option>').join('')+'</datalist></div>';
    html+='<div class="formfield"><label>Зона / местоположение *</label><input id="q31-zone" value="'+escQ(presetZone)+'" maxlength="200" placeholder="Холодный цех"></div>';
    html+='<div class="formfield"><label>Ответственный *</label>';
    const scheduleOwner=(state.schedules||[]).find(x=>x.template_code===selectedCode)?.owner||'';
    let staff=employees();
    let presetOwner=p?.responsible||scheduleOwner||
      (staff.some(x=>x.name===currentAccount?.display_name)?currentAccount.display_name:'')||
      (staff.length===1?staff[0].name:'');
    if(staff.length){
      html+='<select id="q31-responsible"><option value="">Выберите сотрудника</option>'+
          staff.map(x=>'<option value="'+escQ(x.name)+'" '+(x.name===presetOwner?'selected':'')+'>'+escQ(x.name)+(x.position?' — '+escQ(x.position):'')+'</option>').join('')+
          '</select>';
    } else {
      html+='<input id="q31-responsible" maxlength="150" value="'+escQ(presetOwner)+'" placeholder="Добавьте сотрудника или укажите ФИО">';
    }
    html+='</div>';
    for(const c of cols.filter(c=>c.kind==='fixed')){
      html+='<div class="formfield"><label>'+escQ(c.label)+(c.required?' *':'')+'</label>'+
        '<input maxlength="500" data-qfixed="'+escQ(c.key)+'" value="'+escQ(p?.fixed?.[c.key]||'')+'" placeholder="Постоянное значение"></div>';
    }
    html+='</div><div class="quick31-actions"><button class="btn primary" onclick="quick31SaveProfile()">Сохранить настройки</button>'+
          (p?'<button class="btn" onclick="quick31Edit(false)">Отмена</button>':'')+
          '</div><p class="fine">Сохраняются только выбранное оборудование, место, ответственный и постоянные реквизиты. Фактические результаты не сохраняются как шаблон.</p>';
  }else{
    html+='<div class="quick31-meta"><strong>'+escQ(p.equipment)+'</strong> · '+escQ(p.zone)+'<br>Ответственный: '+escQ(p.responsible)+'<br>'+
      'Дата и время записи: <b>автоматически при сохранении</b><br>'+
      '<button class="btn" onclick="quick31Edit(true)">⚙ Изменить постоянные данные</button></div>';
    let readings=cols.filter(x=>x.kind==='reading');
    if(readings.length)html+='<div class="quick31-heading">Введите только фактические значения</div>';
    readings.forEach((c,i)=>{
      let isTextArea=/примечан|комментар|действи|коррекц|причин/i.test(c.label);
      html+='<div class="formfield"><label>'+escQ(c.label)+(c.required?' *':'')+'</label>'+
        (isTextArea?'<textarea data-qactual="'+escQ(c.key)+'" rows="2" placeholder="Введите реальный результат"></textarea>':
        '<input data-qactual="'+escQ(c.key)+'" autocomplete="off" inputmode="'+(/температур|влажност|масс|количеств|давлен|числ/i.test(c.label)?'decimal':'text')+
        '" placeholder="Введите реальное значение" '+(i===0?'autofocus':'')+'>')+'</div>';
    });
    html+='<details class="quick31-optional"><summary>Комментарий (при необходимости)</summary><div class="formfield"><label>Комментарий</label><textarea id="q31-comment" rows="2" placeholder="Например, причина отклонения"></textarea></div></details>';
    html+='<div class="fine" id="quick31-help">Нажимая «Сохранить фактическое значение», вы подтверждаете, что только что выполнили эту проверку. Дата и время будут поставлены автоматически, а прежние записи останутся в истории.</div>';
  }
  html+='</div>';
  $q('wizard-fields').innerHTML=html;
  let next=$q('wizard-next'),back=$q('wizard-back');
  if(next){next.textContent=p&&!editing?'✓ Сохранить фактическое значение':'✓ Сохранить настройки';next.disabled=sending;}
  if(back)back.textContent='← К журналам';
}
async function load(code){
  const seq=++serial;
  context=null;
  selectedCode=code;
  if($q('wizard-title'))$q('wizard-title').textContent='Загружаю журнал…';
  try{
    let data=await act('quick31_profiles',{code:code});
    if(seq!==serial)return;
    context=data;context.loadedCode=code;selectedProfile=Number(localStorage.getItem(profileStorageKey())||0);
    showProfiles();render();
  }catch(e){toast(e.message);if(seq===serial&&$q('wizard-title'))$q('wizard-title').textContent='Ошибка загрузки журнала';}
}
window.quick31AssetSelected=function(name){
  const asset=(state.assets||[]).find(x=>x.display_name===name);
  if(asset&&asset.location&&$q('q31-zone'))$q('q31-zone').value=asset.location;
  if($q('q31-title')&&(!profile()||$q('q31-title').value===existingTemplate()?.name))
    $q('q31-title').value=name;
};
window.quick31ChangeJournal=function(code){selectedProfile=0;editing=false;requestKey='';load(code);};
window.quick31SelectProfile=function(value){selectedProfile=Number(value)||0;editing=!selectedProfile;requestKey='';if(selectedProfile)localStorage.setItem(profileStorageKey(),String(selectedProfile));render();};
window.quick31Edit=function(enabled){editing=!!enabled;render();};
window.quick31SaveProfile=async function(){
  if(sending)return;
  const fixed={};document.querySelectorAll('[data-qfixed]').forEach(el=>fixed[el.dataset.qfixed]=el.value);
  const payload={code:selectedCode,id:selectedProfile||null,fixed,
    title:profile()?.title||$q('q31-equipment')?.value||'',equipment:$q('q31-equipment')?.value||'',
    zone:$q('q31-zone')?.value||'',responsible:$q('q31-responsible')?.value||''};
  sending=true;disabled(true);
  try{
    const result=await act('quick31_profile_save',payload);
    selectedProfile=result.id;localStorage.setItem(profileStorageKey(),String(selectedProfile));
    editing=false;await load(selectedCode);toast('Постоянные реквизиты сохранены. Теперь вводите только фактические показатели.');
  }catch(e){toast(e.message);}
  finally{sending=false;disabled(false);}
};
window.quick31SaveReading=async function(){
  if(sending)return;
  let p=profile();if(!p)return toast('Сначала создайте настройки журнала');
  let actuals={};document.querySelectorAll('[data-qactual]').forEach(el=>actuals[el.dataset.qactual]=el.value.trim());
  // Clicking the explicitly labeled Save button is the user's confirmation.
  // The server still requires confirmed:true; no automatic record is created.
  if(!requestKey)requestKey=makeRequestKey();
  sending=true;disabled(true);
  try{
    const result=await act('quick31_record',{profile_id:selectedProfile,readings:actuals,
       comment:$q('q31-comment')?.value||'',confirmed:true,request_key:requestKey});
    requestKey='';await refresh();page('wizard');await load(selectedCode);
    const deviations=(result.deviations||[]).length;
    toast('Запись сохранена ('+result.at+').'+(deviations?' Проверьте выявленные отклонения: '+deviations:''));
  }catch(e){toast(e.message);setMessage('Не удалось сохранить запись. Проверьте значение и повторите сохранение.');}
  finally{sending=false;disabled(false);}
};
window.wizardNext=async function(){if(editing||!profile())return quick31SaveProfile();return quick31SaveReading();};
window.wizardBack=function(){page('journals');};
window.jumpWizard=function(){};
window.renderWizard=function(){
  if(!state.venue)return;
  const desired=selectedCode||(state.templates||[])[0]?.code||'';
  if(!desired)return;
  if(context&&context.code===desired){render();return;}
  if(context&&context.loadedCode===desired){render();return;}
  load(desired);
};
window.startWizard=function(code){
  selectedCode=code||(state.templates||[]).find(x=>x.code==='fridge')?.code||
                      (state.templates||[])[0]?.code||'';
  context=null;editing=false;selectedProfile=0;requestKey='';
  page('wizard');
};
/* Every new context is keyed to its journal, even after asynchronous venue switch. */
const oldAct=window.quick31ChangeJournal;
window.quick31ChangeJournal=function(code){context=null;oldAct(code);};
const style=document.createElement('style');
style.textContent='.quick31-simple-tip{color:#c3dcf1;padding:9px 0;font-size:14px}.quick31-optional{margin-top:7px;border:1px solid #4b6285;border-radius:10px;padding:12px}.quick31-optional summary{cursor:pointer;color:#b8cae9}.wizard{grid-template-columns:minmax(0,1fr) 250px!important}.wizard .stepper-card{display:none!important}.wizard .wizard-body{min-height:300px!important}.quick31-layout{display:grid;gap:14px;max-width:960px}.quick31-layout .formfield{margin:3px 0}.quick31-layout .formfield input,.quick31-layout .formfield select,.quick31-layout .formfield textarea{width:100%;box-sizing:border-box;min-height:45px;font-size:15px}.quick31-heading{font-weight:750;font-size:16px;margin-top:12px;color:#69ebb2}.quick31-meta{background:#233758;border:1px solid #44618c;padding:17px;border-radius:12px;line-height:2}.quick31-meta .btn{margin-top:8px}.quick31-actions{display:flex;flex-wrap:wrap;gap:10px}.quick31-confirm{display:flex;gap:10px;align-items:start;line-height:1.5;padding:12px;background:#253854;border:1px solid #536b8f;border-radius:12px}.quick31-confirm input{width:20px;height:20px;flex-shrink:0}.wizard .help-column{min-height:0!important}@media(max-width:950px){.wizard{grid-template-columns:1fr!important}}';
document.head.appendChild(style);
})();