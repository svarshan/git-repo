'use strict';
(function(){
const birds=Array.isArray(window.BIRDS_DATA)?window.BIRDS_DATA:[];
const byId=new Map(birds.map(x=>[x.id,x]));
const $=s=>document.querySelector(s);
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const raw=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d;}catch{return d;}};
const save=(k,x)=>{try{localStorage.setItem(k,JSON.stringify(x));return true;}catch{toast('Ошибка записи на диск');return false;}};
let favs=new Set((raw('ptitsy-nn.favorites.v1',[])||[]).filter(id=>byId.has(id)));
let journal=raw('ptitsy-nn.journal.v1',[]);if(!Array.isArray(journal))journal=[];
let page='catalog',visible=28,selected=null,currentAudio=null;
const groups=[...new Set(birds.map(b=>b.group).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'));
$('#group').innerHTML+='<option value="other">Прочие виды</option>'+groups.map(g=>'<option value="'+esc(g)+'">'+esc(g)+'</option>').join('');
function toast(t){const el=$('#notice');el.textContent=t;el.classList.add('show');clearTimeout(toast.h);toast.h=setTimeout(()=>el.classList.remove('show'),2800);}
function image(b){return b.imageFile?'<img loading="lazy" alt="'+esc(b.name)+'" src="'+esc(b.imageFile)+'">':'<span class="missing">Проверенная фотография отсутствует</span>';}
function birdCard(b){return '<article class="bird"><button type="button" class="photo" data-open="'+esc(b.id)+'">'+image(b)+(b.audioFile?'<span class="playmark">♪ Есть запись</span>':'')+'</button><div class="meta"><h3>'+esc(b.name)+'</h3><div class="latin">'+esc(b.latin)+'</div><div class="minor">'+esc(b.group||'Птицы области')+'</div><div class="actions"><button data-open="'+esc(b.id)+'">Подробнее →</button><button data-fav="'+esc(b.id)+'">'+(favs.has(b.id)?'♥ В избранном':'♡ Сохранить')+'</button></div></div></article>';}
function currentList(){const q=$('#search').value.toLocaleLowerCase('ru').replace(/ё/g,'е').trim(),g=$('#group').value,type=$('#only').value;return birds.filter(b=>{
if(q&&!(b.name+' '+b.latin).toLocaleLowerCase('ru').replace(/ё/g,'е').includes(q))return false;
if(g==='other'&&b.group)return false;
if(g!=='all'&&g!=='other'&&g!==b.group)return false;
if(type==='image'&&!b.imageFile)return false;if(type==='audio'&&!b.audioFile)return false;if(type==='article'&&!b.articleComplete)return false;
return true;});}
function renderCatalog(){const arr=currentList();$('#foundCount').textContent=arr.length+' видов';$('#grid').innerHTML=arr.slice(0,visible).map(birdCard).join('')||'<p>Нет результатов. Измените фильтры.</p>';$('#more').hidden=arr.length<=visible;}
function renderFav(){const arr=birds.filter(b=>favs.has(b.id));$('#favoriteGrid').innerHTML=arr.length?arr.map(birdCard).join(''):'<p>Добавляйте птиц в избранное кнопкой ♡ в каталоге.</p>';}
function counters(){for(const [selector,n] of [['#countAll',birds.length],['#countImages',birds.filter(b=>b.imageFile).length],['#countAudio',birds.filter(b=>b.audioFile).length],['#countArticles',birds.filter(b=>b.articleComplete).length]])$(selector).textContent=n;}
function switchPage(next){window.BirdUltra?.closeAll();stop();page=next;document.querySelectorAll('.view').forEach(x=>x.hidden=x.id!==next);document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('navactive',x.dataset.view===next));if(next==='catalog')renderCatalog();if(next==='favorites')renderFav();if(next==='journal')renderJournal();if(next==='field')window.BirdFieldAssistant?.render($('#fieldContent'),birds,openBird);if(next==='compare')window.BirdAudioPro?.mountCompare($('#compareContent'),birds);if(next==='lab')window.BirdVoiceLab?.render($('#labContent'),birds);if(next==='about')renderCoverage();window.scrollTo(0,0);}
function fav(id){if(!byId.has(id))return;favs.has(id)?favs.delete(id):favs.add(id);save('ptitsy-nn.favorites.v1',[...favs]);renderCatalog();renderFav();}
function source(b,field,label){const d=b[field];if(!d)return '<p><b>'+esc(label)+':</b> свободный подтверждённый материал не найден.</p>';const u=d.source||'';const link=/^https:\/\/(commons\.wikimedia\.org\/|www\.inaturalist\.org\/observations\/|xeno-canto\.org\/)/.test(u)?'<a href="'+esc(u)+'" target="_blank" rel="noreferrer">Посмотреть оригинал ↗</a>':'';return '<p><b>'+esc(label)+':</b> '+esc(d.author||'Автор указан на странице оригинала')+', '+esc(d.license||'лицензия неизвестна')+'. '+link+'</p>';}
function stop(){window.BirdAudioPro?.stopAll();if(currentAudio){currentAudio.pause();currentAudio.currentTime=0;currentAudio=null;}if('speechSynthesis'in window)speechSynthesis.cancel();}
function play(b){stop();if(!b.audioFile)return toast('Нет проверенной записи голоса');const a=new Audio(b.audioFile);a.volume=1;currentAudio=a;a.onended=()=>{currentAudio=null;};a.onerror=()=>toast('Не удалось воспроизвести аудиофайл');a.play().catch(()=>toast('Не удалось начать воспроизведение'));}
function speak(b){stop();if(!('speechSynthesis'in window))return toast('В Windows не настроен системный голос');const isEnglish=b.descriptionLanguage==='en';const s=new SpeechSynthesisUtterance((isEnglish?b.latin:b.name)+'. '+(b.description||'Описание вида пока недоступно.').slice(0,6000));s.lang=isEnglish?'en-US':'ru-RU';s.rate=.94;const voice=speechSynthesis.getVoices().find(x=>x.lang.toLowerCase().startsWith(isEnglish?'en':'ru'));if(voice)s.voice=voice;speechSynthesis.speak(s);}
function showDialog(){const overlay=$('#overlay');overlay.hidden=false;document.body.classList.add('dialog-open');overlay.scrollTop=0;const modal=overlay.querySelector('.modal');if(modal)modal.scrollTop=0;}
function openBird(id){const b=byId.get(id);if(!b)return;window.BirdFieldAssistant?.markRecent(id);selected=id;const d=$('#dialogContent');const english=b.descriptionLanguage==='en';const articleNote=english?'Подробная статья найдена на английском языке. Ниже оригинальный текст, без машинного перевода.':b.articleComplete?'Текст статьи из русской Википедии.':'Для этого вида пока доступна только краткая проверенная справка.';d.innerHTML='<div class="detailphoto">'+image(b)+'</div><div class="dialogbody"><h2>'+esc(b.name)+'</h2><div class="latin">'+esc(b.latin)+' · '+esc(b.group||'')+'</div><div class="controls"><button id="compareFrom" type="button">⇄ Сравнить голоса</button><button id="quickObserve" type="button">+ Записать наблюдение</button><button id="read">▶ Озвучить описание</button><button id="stop">■ Стоп</button><button id="dialogFav">'+(favs.has(id)?'♥ Убрать из избранного':'♡ Сохранить')+'</button></div><div id="birdAudioPro"></div><h3>Описание</h3><p class="article-note">'+esc(articleNote)+'</p><div lang="'+(english?'en':'ru')+'">'+esc(b.description||'Подробное описание ещё не найдено.').split(/\n{2,}/).map(x=>'<p>'+x.replace(/\n/g,' ')+'</p>').join('')+'</div><h3>Региональный перечень</h3><p>Вид включён в опубликованный систематический список птиц Нижегородской области. Характер пребывания в конкретном районе и актуальный охранный статус требуют отдельной проверки.</p><section class="credits"><h3>Источники, авторы и лицензии</h3>'+source(b,'imageCredits','Фотография')+source(b,'audioCredits','Звукозапись')+(b.descriptionSource?'<p><b>Описание:</b> <a target="_blank" rel="noreferrer" href="'+esc(b.descriptionSource)+'">'+(english?'Английская':'Русская')+' Википедия ↗</a>, авторы — участники Википедии, CC BY-SA 4.0. Фрагмент сокращён. <a target="_blank" rel="noreferrer" href="https://creativecommons.org/licenses/by-sa/4.0/">Лицензия ↗</a>.</p>':'<p>Описание: краткая редакционная карточка либо ожидается источник.</p>')+'<p><a href="https://www.oiseaux.net/en/oiseaux/russia/famille.nizhegorodskaya.oblast.html" target="_blank" rel="noreferrer">Публикация регионального перечня ↗</a></p></section></div>';
showDialog();window.BirdAudioPro?.mountCard($('#birdAudioPro'),b);$('#compareFrom')?.addEventListener('click',()=>{close();switchPage('compare');window.BirdAudioPro?.mountCompare($('#compareContent'),birds,b.id);});$('#quickObserve')?.addEventListener('click',()=>openForm(null,b.id));$('#read').addEventListener('click',()=>speak(b));$('#stop').addEventListener('click',stop);$('#dialogFav').addEventListener('click',()=>{fav(id);$('#dialogFav').textContent=favs.has(id)?'♥ Убрать из избранного':'♡ Сохранить';});}
function openForm(existingId=null,preferredBird=null){
 const observation=existingId?journal.find(x=>x.id===existingId):null;
 selected=null;
 const edit=Boolean(observation);
 $('#dialogContent').innerHTML='<div class="dialogbody"><h2>'+(edit?'Редактировать наблюдение':'Новое наблюдение')+
 '</h2><form id="obsForm" class="fields"><label>Птица<select id="obsBird" required>'+
 birds.map(b=>'<option value="'+esc(b.id)+'">'+esc(b.name)+'</option>').join('')+
 '</select></label><label>Дата и время<input id="obsDate" required type="datetime-local"></label>'+
 '<label>Место наблюдения<input required maxlength="160" id="obsPlace" placeholder="Например: Керженский заповедник"></label>'+
 '<label>Количество птиц<input id="obsCount" type="number" min="1" max="99999" value="1" required></label>'+
 '<label>Примечание<textarea id="obsNotes" rows="3" maxlength="2000" placeholder="Оперение, поведение, погода"></textarea></label>'+
 '<button type="submit" class="primary">'+(edit?'Сохранить изменения':'Добавить наблюдение')+'</button></form></div>';
 const now=new Date();
 $('#obsDate').value=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,16);
 if(observation){
  $('#obsBird').value=observation.birdId;$('#obsDate').value=observation.date;
  $('#obsPlace').value=observation.place;$('#obsCount').value=observation.count;
  $('#obsNotes').value=observation.notes||'';
 }else if(preferredBird&&byId.has(preferredBird))$('#obsBird').value=preferredBird;
 showDialog();
 $('#obsForm').addEventListener('submit',e=>{
  e.preventDefault();
  const birdId=$('#obsBird').value,date=$('#obsDate').value,place=$('#obsPlace').value.trim(),
        count=Number($('#obsCount').value),notes=$('#obsNotes').value.trim();
  if(!byId.has(birdId)||place.length<1||place.length>160||!date||
     !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(date)||
     !Number.isInteger(count)||count<1||count>99999||notes.length>2000)
    return toast('Проверьте дату, место и количество птиц');
  const entry={id:observation?.id||crypto.randomUUID?.()||String(Date.now()),
               birdId,date,place,count,notes};
  const next=edit?journal.map(x=>x.id===observation.id?entry:x):[...journal,entry];
  if(save('ptitsy-nn.journal.v1',next)){
   journal=next;close();renderJournal();toast(edit?'Наблюдение обновлено':'Наблюдение сохранено');
  }
 });
}
function renderJournal(){
 const input=$('#journalSearch'),filter=$('#journalBirdFilter'),sort=$('#journalSort'),summary=$('#journalSummary');
 const previous=filter.value;
 filter.replaceChildren();
 const choices=[...new Set(journal.map(x=>x.birdId).filter(x=>byId.has(x)))];
 const base=document.createElement('option');base.value='all';base.textContent='Все птицы';filter.appendChild(base);
 for(const id of choices.sort((a,b)=>(byId.get(a)?.name||'').localeCompare(byId.get(b)?.name||'','ru'))){
  const item=document.createElement('option');item.value=id;item.textContent=byId.get(id)?.name||id;filter.appendChild(item);
 }
 filter.value=choices.includes(previous)?previous:'all';
 const q=(input.value||'').toLocaleLowerCase('ru').replace(/ё/g,'е').trim();
 const filtered=journal.filter(j=>{
  if(filter.value!=='all'&&j.birdId!==filter.value)return false;
  const haystack=((byId.get(j.birdId)?.name||'')+' '+(j.place||'')+' '+(j.notes||'')).toLocaleLowerCase('ru').replace(/ё/g,'е');
  return !q||haystack.includes(q);
 }).sort((a,b)=>sort.value==='old'?a.date.localeCompare(b.date):b.date.localeCompare(a.date));
 summary.textContent='Наблюдений: '+filtered.length+' из '+journal.length+
  ' · Уникальных видов: '+new Set(filtered.map(x=>x.birdId)).size+
  ' · Всего птиц: '+filtered.reduce((n,x)=>n+(Number(x.count)||0),0);
 $('#journalItems').innerHTML=filtered.length?filtered.map(j=>
 '<article class="journalrow"><div><strong>'+esc(byId.get(j.birdId)?.name||'Неизвестный вид')+
 '</strong><small>'+esc((j.date||'').replace('T',' '))+' · '+esc(j.place)+' · '+Number(j.count||0)+' шт.</small>'+
 '<p>'+esc(j.notes||'')+'</p></div><div class="journalrow-actions">'+
 '<button type="button" data-edit="'+esc(j.id)+'">Изменить</button>'+
 '<button type="button" data-remove="'+esc(j.id)+'">Удалить</button></div></article>'
 ).join(''):'<p class="field-muted">Наблюдений по фильтру нет. Измените параметры или добавьте новую запись.</p>';
}
function download(filename,content,type){const u=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=u;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),3000);}
function csv(t){t=String(t??'').replace(/\r?\n/g,' ');if(/^[=+@\-]/.test(t))t="'"+t;return '"'+t.replace(/"/g,'""')+'"';}
function exportCSV(){const h=['Дата','Птица','Латинское название','Место','Количество','Примечание'];const rows=journal.map(j=>[j.date,byId.get(j.birdId)?.name,byId.get(j.birdId)?.latin,j.place,j.count,j.notes]);download('observations.csv','\ufeff'+[h,...rows].map(row=>row.map(csv).join(';')).join('\r\n'),'text/csv;charset=utf-8');}
function renderCoverage(){const p=$('#coverage');p.textContent='Всего видов: '+birds.length+'. С фотографиями: '+birds.filter(b=>b.imageFile).length+'. С настоящими звукозаписями: '+birds.filter(b=>b.audioFile).length+'. С расширенным текстом: '+birds.filter(b=>b.articleComplete).length+'. Записи без материалов честно помечены.';}
function close(){window.BirdUltra?.closeAll();stop();$('#overlay').hidden=true;document.body.classList.remove('dialog-open');selected=null;}
document.addEventListener('click',e=>{const b=e.target.closest('button,[data-close]');if(!b)return;if(b.dataset.view){switchPage(b.dataset.view);return;}if(b.dataset.open){openBird(b.dataset.open);return;}if(b.dataset.fav){fav(b.dataset.fav);return;}if(b.dataset.close||b.id==='close'){close();return;}if(b.id==='more'){visible+=28;renderCatalog();return;}if(b.id==='newObservation'){openForm();return;}if(b.dataset.edit){openForm(b.dataset.edit);return;}if(b.dataset.remove){if(confirm('Удалить запись?')){journal=journal.filter(x=>x.id!==b.dataset.remove);save('ptitsy-nn.journal.v1',journal);renderJournal();}return;}});
for(const s of ['#search','#group','#only'])$(s).addEventListener(s==='#search'?'input':'change',()=>{visible=28;renderCatalog();});
$('#exportJSON').addEventListener('click',()=>download('observations.json',JSON.stringify({type:'ptitsy-nn-journal',version:1,observations:journal},null,2),'application/json'));
$('#exportCSV').addEventListener('click',exportCSV);
for(const id of ['#journalSearch','#journalBirdFilter','#journalSort'])$(id).addEventListener(id==='#journalSearch'?'input':'change',renderJournal);
$('#importJSON').addEventListener('click',()=>$('#importFile').click());
$('#importFile').addEventListener('change',async e=>{const file=e.target.files[0];if(!file||file.size>5e6)return toast('Неправильный файл');try{const obj=JSON.parse(await file.text());if(obj.type!=='ptitsy-nn-journal'||obj.version!==1||!Array.isArray(obj.observations)||obj.observations.length>20000||obj.observations.some(x=>!x||typeof x.id!=='string'||!byId.has(x.birdId)||!x.date||!x.place||!Number.isInteger(x.count)||x.count<1||x.count>99999))throw Error('Неверная структура');if(confirm('Заменить текущий дневник данными файла?')){journal=obj.observations;save('ptitsy-nn.journal.v1',journal);renderJournal();toast('Дневник восстановлен');}}catch(err){toast('Ошибка импорта: '+err.message);}e.target.value='';});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#overlay').hidden)close();if(e.ctrlKey&&e.key.toLowerCase()==='f'){e.preventDefault();switchPage('catalog');$('#search').focus();}});
counters();renderCatalog();window.__APP_TEST__={species:birds.length,photos:birds.filter(b=>b.imageFile).length,audio:birds.filter(b=>b.audioFile).length};
})();