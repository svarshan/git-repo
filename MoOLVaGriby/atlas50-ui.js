'use strict';

(() => {
  const core=window.MoOLVaAtlas50;
  const atlas=window.MoOLVaAtlas40;
  const data=window.MoOLVaAtlas50Current;
  const groups=window.MoOLVaAtlas50Groups;
  const byId=id=>document.getElementById(id);
  const esc=value=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const link=(href,text)=>'<a href="'+esc(href)+'" target="_blank" rel="noopener noreferrer">'+esc(text)+' ↗</a>';
  const danger=item=>['ядовитый','смертельно-ядовитый'].includes(item.risk)
    ? '<span class="atlas50-danger">'+esc(item.risk)+'</span>' : '';
  const speciesButton=item=>'<button type="button" class="icon-btn" data-open="'+esc(item.id)+'">'+esc(item.name)+'</button>';

  const groupSelect=byId('atlas50-group');
  groupSelect.innerHTML=groups.map(g=>'<option value="'+g.id+'">'+esc(g.title)+'</option>').join('');
  function render(){
    const group=groups.find(g=>g.id===groupSelect.value);
    const host=byId('atlas50-comparison');
    if(!group){host.textContent='Группы для сравнения недоступны.';return;}
    const rows=core.matrix(group,atlas).filter(row=>!byId('atlas50-differences').checked||row.status!=='same');
    const table=rows.length?'<div class="atlas50-scroll" tabindex="0" role="region" aria-label="Таблица признаков"><table><thead><tr><th scope="col">Признак</th>'+
      group.entries.map(({item})=>'<th scope="col">'+speciesButton(item)+'<i>'+esc(item.latin)+'</i>'+danger(item)+'</th>').join('')+
      '</tr></thead><tbody>'+rows.map(row=>'<tr data-trait="'+row.key+'" data-relation="'+row.status+'"><th scope="row">'+esc(row.label)+
      '<small>'+({same:'Общий',differs:'Различается',partial:'Неполные данные'}[row.status])+'</small></th>'+
      row.values.map(value=>value?'<td>'+esc(value)+'</td>':'<td class="atlas50-missing">Нет описания</td>').join('')+
      '</tr>').join('')+'</tbody></table></div>':'<p class="note">Для этой группы нет строк с различиями или пробелами в данных.</p>';
    host.innerHTML='<p class="note">'+esc(group.description)+'</p>'+table+
      '<div class="atlas50-cards">'+group.entries.map(({item,note,source})=>'<article>'+speciesButton(item)+
      danger(item)+'<p>'+esc(note)+'</p>'+link(source,'Справочник')+'</article>').join('')+'</div>';
  }
  groupSelect.addEventListener('change',render);
  byId('atlas50-differences').addEventListener('change',render);
  function showGroup(id) {
    if(!groups.some(g=>g.id===id))return;
    groupSelect.value=id;
    render();
    document.querySelector('[data-page="lookalikes"]').click();
    groupSelect.focus();
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-atlas50-group]');
    if(button)showGroup(button.dataset.atlas50Group);
  });
  render();

  const exercises=core.practice(groups,atlas);
  const lesson=byId('atlas50-lesson');
  const progressKey='moolva-griby-atlas-v50-training';
  let progress={};
  try{
    const saved=JSON.parse(localStorage.getItem(progressKey)||'{}');
    progress=Object.fromEntries(exercises.filter(x=>Number.isInteger(saved[x.id]) && saved[x.id]>=0 && saved[x.id]<=9)
      .map(x=>[x.id,saved[x.id]]));
  }catch{ /* Begin with an empty history. */ }
  let question;
  let attempts=0,correct=0;
  function next() {
    const pool=exercises.length>1 ? exercises.filter(x=>x!==question) : exercises;
    if(!pool.length){lesson.textContent='В текущем пакете нет заданий с однозначно записанным ответом.';return;}
    const weighted=pool.flatMap(x=>Array.from({length:1+(progress[x.id]||0)},()=>x));
    question=weighted[Math.floor(Math.random()*weighted.length)];
    lesson.innerHTML='<p class="muted">'+esc(question.group.title)+'</p>'+
      '<h3 tabindex="-1">У какого вида отмечен этот признак?</h3><p><b>'+esc(question.row.label)+'</b> · '+esc(question.value)+'</p>'+
      '<div class="atlas40-choices">'+question.group.entries.map(({item},index)=>
        '<button type="button" data-atlas50-answer="'+index+'">'+esc(item.name)+'</button>').join('')+
      '</div><p id="atlas50-feedback" role="status"></p>';
  }
  lesson.addEventListener('click',event=>{
    const button=event.target.closest('button');
    if(!button)return;
    if(button.id==='atlas50-next'){
      next();
      lesson.querySelector('h3')?.focus();
      return;
    }
    if(!Object.hasOwn(button.dataset,'atlas50Answer'))return;
    const yes=Number(button.dataset.atlas50Answer)===question.index;
    attempts++;
    if(yes)correct++;
    const old=progress[question.id]||0;
    progress[question.id]=yes?Math.max(0,old-1):Math.min(9,old+2);
    try{window.MoOLVaProfile41.setItem(progressKey,JSON.stringify(progress));}catch{ /* Exercises remain available. */ }
    byId('atlas50-feedback').innerHTML=(yes?'Верно. ':'Правильный ответ — ')+
      '<b>'+esc(question.group.entries[question.index].item.name)+'</b>. '+esc(question.group.entries[question.index].note);
    lesson.querySelectorAll('[data-atlas50-answer]').forEach(x=>x.disabled=true);
    byId('atlas50-score').textContent='Верных ответов за сеанс: '+correct+' из '+attempts;
    const nextButton=document.createElement('button');
    nextButton.type='button';
    nextButton.id='atlas50-next';
    nextButton.className='primary';
    nextButton.textContent='Следующий вопрос';
    lesson.append(nextButton);
    nextButton.focus();
  });
  next();

  const packKey='moolva-griby-atlas-v50-pack';
  const fileInput=byId('atlas50-package-file');
  const packageState=byId('atlas50-package-status');
  const rollback=byId('atlas50-package-rollback');
  let saved;
  try{saved=JSON.parse(localStorage.getItem(packKey)||'null');}catch{ /* Built-in package is available. */ }
  function validPrevious() {
    try{return saved?.previous ? core.validate(saved.previous) : null;}catch{return null;}
  }
  const previous=validPrevious();
  if(previous){
    rollback.hidden=false;
    rollback.textContent='Вернуться к пакету '+previous.version;
  }
  packageState.textContent='Пакет данных № '+data.version+' · групп: '+groups.length;
  function activate(current) {
    window.MoOLVaProfile41.setItem(packKey,JSON.stringify({current,previous:data}));
    if(window.MoOLVaReliability?.reloadAtlas)window.MoOLVaReliability.reloadAtlas();
    else location.reload();
  }
  fileInput.addEventListener('change',async ()=>{
    const file=fileInput.files[0];
    fileInput.value='';
    if(!file)return;
    try{
      if(file.size>core.maxSize)throw Error('Пакет превышает 512 КБ.');
      const incoming=core.readPackage(await file.text());
      if(incoming.version<=data.version)throw Error('Уже используется такой же или более новый пакет.');
      const known=new Set(window.MOOLVA_MUSHROOMS.map(item=>item.latin).concat(incoming.publications.map(p=>p.latin)));
      if(incoming.groups.some(group=>group.entries.some(([latin])=>!known.has(latin)))) {
        throw Error('В пакете есть виды без карточек. Установите более свежую версию программы.');
      }
      activate(incoming);
    }catch(error){
      packageState.textContent=error instanceof SyntaxError?'Не удалось прочитать JSON пакета.':error.message;
    }
  });
  rollback.addEventListener('click',()=>{
    if(!previous)return;
    try{activate(previous);}catch{packageState.textContent='Не удалось записать предыдущий пакет.';}
  });
})();
