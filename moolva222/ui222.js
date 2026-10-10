/* Guided enterprise creation. UI forms configure future journals, NEVER actual readings or signatures. */
(function(){
"use strict";
let w={step:0,data:{},staff:[],journals:[],kindLoaded:""},busy=false;
const steps=["Тип заведения","Реквизиты","Сотрудники","Рекомендуемые журналы","Даты и ответственные","Проверка"];
const details=["venue_name","kind","legal_name","inn","ogrn","address","legal_address","director","responsible","phone","email"];
const labels={venue_name:"Название предприятия *",kind:"Тип объекта *",legal_name:"Юридическое название",
 inn:"ИНН",ogrn:"ОГРН / ОГРНИП",address:"Фактический адрес",legal_address:"Юридический адрес",
 director:"Генеральный директор",responsible:"Ответственный за ХАССП",phone:"Телефон",email:"Электронная почта"};
const examples={venue_name:"Столовая № 1",legal_name:"ООО «Вкусный мир»",inn:"5250123456",ogrn:"1235250000123",
 address:"Нижний Новгород, ул. Центральная, 7",legal_address:"Укажите, если отличается",
 director:"Иванов Иван Иванович",responsible:"Иванова Мария Петровна",phone:"+7 831 123-45-67",email:"info@example.ru"};
const periods=[["daily","Ежедневно"],["weekly","Еженедельно"],["monthly","Ежемесячно"],["yearly","Ежегодно"]];
const $=id=>document.getElementById(id);
const h=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const today=()=>{let d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")};
const inform=x=>{if(typeof toast==="function")toast(x);else alert(x)};
const hint=txt=>'<button class="o222-tip" type="button" title="'+h(txt)+'" aria-label="Подсказка">?</button>';
function field(k){
 let inner=k==="kind"?
   '<select id="o222-kind">'+Array.from($("ve-kind").options).map(o=>'<option value="'+h(o.value)+'"'+(o.value===w.data.kind?' selected':'')+'>'+h(o.text)+'</option>').join("")+'</select>':
   '<input id="o222-'+k+'" value="'+h(w.data[k]||"")+'" placeholder="'+h(examples[k]||"")+'" maxlength="400">';
 return '<div class="o222-field"><label>'+h(labels[k])+' '+hint("Введите: "+(examples[k]||"тип предприятия"))+'</label>'+inner+'<small>'+h(examples[k]||"Выберите тип из списка")+'</small></div>';
}
function staffRow(x,i){
 return '<div class="o222-person"><input data-person="name" value="'+h(x.name||"")+
   '" placeholder="ФИО — Иванова Мария Петровна"><input data-person="position" value="'+h(x.position||"")+
   '" placeholder="Должность — шеф-повар"><button class="btn" type="button" data-remove="'+i+'">Удалить</button></div>';
}
function selectOptions(selected){
 return '<option value="">Ответственный из реквизитов</option>'+w.staff.filter(x=>x.name).map(x=>
   '<option value="'+h(x.name)+'"'+(x.name===selected?' selected':'')+'>'+h(x.name)+'</option>').join("");
}
function journalRow(x){
 return '<tr data-journal="'+h(x.code)+'"><td><label class="o222-check"><input type="checkbox" data-col="enabled"'+
  (x.enabled?' checked':'')+'><span><b>'+h(x.name)+'</b><small>'+(x.recommended?'Рекомендовано':'Дополнительный журнал')+
  '</small></span></label></td><td><select data-col="cadence">'+periods.map(z=>'<option value="'+z[0]+'"'+
  (x.cadence===z[0]?' selected':'')+'>'+z[1]+'</option>').join("")+'</select></td>'+
  '<td><input data-col="date" type="date" value="'+h(x.start_on)+'"></td>'+
  '<td><input data-col="clock" type="time" value="'+h(x.clock)+'"></td>'+
  '<td><select data-col="staff">'+selectOptions(x.employee)+'</select></td></tr>';
}
function collect(){
 if(w.step<=1){for(const k of details){const el=$("o222-"+k);if(el)w.data[k]=el.value.trim()}}
 if(w.step===2)w.staff=Array.from(document.querySelectorAll("#o222-persons .o222-person")).map(
    row=>({name:row.querySelector('[data-person="name"]').value.trim(),
           position:row.querySelector('[data-person="position"]').value.trim()})).filter(x=>x.name||x.position);
 if(w.step===3||w.step===4){
  document.querySelectorAll("#o222-content tr[data-journal]").forEach(row=>{
   const j=w.journals.find(x=>x.code===row.dataset.journal);if(!j)return;
   j.enabled=row.querySelector('[data-col="enabled"]').checked;
   j.cadence=row.querySelector('[data-col="cadence"]').value;
   j.start_on=row.querySelector('[data-col="date"]').value;
   j.clock=row.querySelector('[data-col="clock"]').value;
   j.employee=row.querySelector('[data-col="staff"]').value;
  });
 }
}
async function loadRecommendations(){
 if(w.kindLoaded===w.data.kind)return;
 const resp=await api("/api/action",{action:"onboarding_preview",kind:w.data.kind});
 const prev=new Map(w.journals.map(x=>[x.code,x]));
 w.journals=resp.journals.map(j=>{
  const old=prev.get(j.code);
  return {...j,enabled:old?old.enabled:j.recommended,cadence:old?.cadence||j.cadence,
   start_on:old?.start_on||today(),clock:old?.clock||"09:00",employee:old?.employee||""};
 });
 w.kindLoaded=w.data.kind;
}
function render(){
 const title=$("o222-title");title.textContent="Новое предприятие · "+steps[w.step]+" · шаг "+(w.step+1)+" из 6";
 $("o222-progress").innerHTML=steps.map((x,i)=>'<span title="'+h(x)+'" class="'+(i<=w.step?'active':'')+'"></span>').join("");
 $("o222-back").disabled=w.step===0||busy;
 $("o222-next").disabled=busy;
 $("o222-next").textContent=w.step===5?"Создать предприятие ✓":"Далее →";
 let c="";
 if(w.step===0)c='<p>Выберите тип предприятия и его название — журналы будут предложены автоматически.</p><div class="o222-grid">'+field("venue_name")+field("kind")+
   '</div><p class="o222-info">Рекомендации следует сверить с фактическими процессами, утверждённой ППК и требованиями объекта.</p>';
 if(w.step===1)c='<p>Введите известные реквизиты. Необязательные можно добавить позднее.</p><div class="o222-grid">'+
   details.filter(x=>x!=="kind"&&x!=="venue_name").map(field).join("")+'</div>';
 if(w.step===2)c='<p>Добавьте сотрудников для назначения журналов. Это справочник персонала, не пользователи для входа в систему.</p>'+
   '<div id="o222-persons">'+w.staff.map(staffRow).join("")+'</div>'+
   '<button id="o222-add" type="button" class="btn">＋ Добавить сотрудника</button>';
 if(w.step===3||w.step===4){
  const filtered=w.step===3?w.journals:w.journals.filter(x=>x.enabled);
  c='<p>'+(w.step===3?'Отметьте нужные журналы. Можно убрать предложенные или добавить другие.':
       'Поставьте даты начала ведения, время, периодичность и сотрудников. Подписи и результаты осмотра не заполняются автоматически.')+'</p>';
  if(w.step===4)c+='<div class="o222-bulk"><label>Дата для всех <input id="o222-all-date" type="date" value="'+today()+'"></label>'+
   '<label>Ответственный для всех <select id="o222-all-staff">'+selectOptions("")+'</select></label>'+
   '<button class="btn" type="button" id="o222-apply">Применить ко всем ↓</button></div>';
  c+='<div class="o222-scroll"><table class="o222-table"><thead><tr><th>Название журнала</th><th>Период</th><th>Дата начала</th>'+
   '<th>Время</th><th>Ответственный</th></tr></thead><tbody>'+filtered.map(journalRow).join("")+
   '</tbody></table></div><p class="o222-info">Внесённые даты — плановые. Фактические записи и реальные подписи появятся только после выполнения проверки сотрудником.</p>';
 }
 if(w.step===5){
  const journals=w.journals.filter(x=>x.enabled);
  c='<p>Проверьте перед сохранением:</p><div class="o222-summary"><h3>'+h(w.data.venue_name)+'</h3><div>Тип: '+h(w.data.kind)+
   '</div><div>Сотрудников: '+w.staff.length+'</div><div>Журналов с графиком: '+journals.length+'</div>'+
   journals.map(x=>'<div>• '+h(x.name)+' — '+h(x.start_on)+' — '+h(x.employee||w.data.responsible||w.data.director)+'</div>').join("")+
   '</div><p class="o222-info">Сохранится план. Никаких фиктивных фактических записей и подписей программа не создаёт.</p>';
 }
 $("o222-content").innerHTML=c;
 $("o222-content").scrollTop=0;
 if(w.step===2){
  $("o222-add").onclick=()=>{collect();w.staff.push({name:"",position:""});render()};
  document.querySelectorAll("#o222-persons [data-remove]").forEach(el=>el.onclick=()=>{
   collect();w.staff.splice(+el.dataset.remove,1);render();
  });
 }
 if(w.step===4){
  $("o222-apply").onclick=()=>{
   const d=$("o222-all-date").value,owner=$("o222-all-staff").value;
   if(!d){inform("Укажите дату");return}
   document.querySelectorAll('#o222-content tr[data-journal]').forEach(row=>{
    row.querySelector('[data-col="date"]').value=d;
    if(owner)row.querySelector('[data-col="staff"]').value=owner;
   });
   $("o222-note").textContent="Дата и ответственный назначены";
  };
 }
}
function verify(){
 const d=w.data;
 if(w.step===0&&!d.venue_name)return "Введите название заведения";
 if(w.step===1){
  if(d.inn&&!/^\d{10}$|^\d{12}$/.test(d.inn))return "ИНН: 10 или 12 цифр";
  if(d.ogrn&&!/^\d{13}$|^\d{15}$/.test(d.ogrn))return "ОГРН: 13 или 15 цифр";
 }
 if(w.step===2&&w.staff.some(x=>!x.name||!x.position))return "Укажите ФИО и должность";
 if(w.step===4){
  for(const j of w.journals.filter(x=>x.enabled)){
   if(!j.start_on||!j.clock)return "Укажите дату и время для каждого журнала";
   if(!j.employee&&!d.responsible&&!d.director)return "Выберите ответственного за журнал «"+j.name+"»";
  }
 }
 return "";
}
async function next(){
 if(busy)return;
 try{
  collect();const err=verify();if(err){inform(err);return}
  if(w.step===0)await loadRecommendations();
  if(w.step<5){w.step++;render();return}
  busy=true;$("o222-next").disabled=true;
  const setup={details:w.data,employees:w.staff,journals:w.journals.filter(x=>x.enabled).map(j=>
     ({code:j.code,cadence:j.cadence,start_on:j.start_on,clock:j.clock,
       employee:j.employee,owner:j.employee||w.data.responsible||w.data.director}))};
  const result=await api("/api/action",{action:"create_venue_guided",setup});
  $("o222-modal").classList.remove("show");
  await refresh(result.venue);
  page("home");
  inform("Предприятие создано, графиков журналов: "+result.schedules);
 }catch(e){inform("Ошибка: "+e.message)}
 finally{busy=false;$("o222-next").disabled=false}
}
function back(){if(w.step===0||busy)return;collect();w.step--;render()}
function open(){
 w={step:0,data:{venue_name:"",kind:"Столовая",legal_name:"",inn:"",ogrn:"",address:"",
    legal_address:"",director:"",responsible:"",phone:"",email:""},staff:[],journals:[],kindLoaded:""};
 const pre=$("new-venue-name");if(pre&&pre.value.trim())w.data.venue_name=pre.value.trim();
 document.body.appendChild($("o222-modal"));$("o222-modal").classList.add("show");render();
}
window.openCreateVenue=open;
window.createVenue=open;
$("o222-next").onclick=next;
$("o222-back").onclick=back;
$("o222-close").onclick=()=>$("o222-modal").classList.remove("show");
})();
