'use strict';

(() => {
  const atlas = window.MoOLVaAtlas40;
  const species = window.MOOLVA_MUSHROOMS;
  const byId = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g,char =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  const dialog = byId('atlas40-glossary');
  const glossaryList = byId('atlas40-terms');
  glossaryList.innerHTML = Object.entries(atlas.glossary).map(([key,term]) =>
    '<button type="button" data-atlas-term="'+key+'" aria-pressed="false">'+escape(term.title)+'</button>').join('');
  function showTerm(key) {
    const term = atlas.glossary[key];
    if (!term) return;
    if (!dialog.open) dialog.showModal();
    for (const button of glossaryList.querySelectorAll('button')) {
      button.setAttribute('aria-pressed',String(button.dataset.atlasTerm === key));
    }
    byId('atlas40-term-name').textContent = term.title;
    byId('atlas40-term-description').textContent = term.desc;
    byId('atlas40-diagram').dataset.part = term.part;
    byId('atlas40-diagram').setAttribute('aria-label','На схеме выделено: '+term.title);
  }
  document.addEventListener('click',event => {
    const control = event.target.closest('[data-atlas-term]');
    if (!control) return;
    showTerm(control.dataset.atlasTerm);
  });

  const answerLabels = {
    ring:{yes:'Вижу кольцо',no:'Кольца не видно'},
    volva:{yes:'Вижу вольву',no:'Вольвы не видно'}
  };
  const host = byId('atlas40-wizard');
  const history = [];
  let shown = 8;
  let current;
  function render(focus = false) {
    const answers = Object.fromEntries(history.filter(step => step.value).map(step => [step.key,step.value]));
    const skipped = history.filter(step => !step.value).map(step => step.key);
    const result = atlas.identify(species,answers,skipped);
    current = result.next;
    const question = atlas.questions[current];
    const selected = Object.keys(answers).length;
    const summary = history.map(({key,value}) => {
      const trait=atlas.questions[key];
      return '<li><label>'+escape(trait.label)+' <select class="atlas50-edit" data-atlas-edit="'+key+'">'+
        '<option value=""'+(!value?' selected':'')+'>Пропущено</option>'+
        Object.entries(trait.values).map(([id,label])=>'<option value="'+id+'"'+(id===value?' selected':'')+'>'+
          escape(answerLabels[key]?.[id]||label)+'</option>').join('')+'</select></label></li>';
    }).join('');

    byId('atlas40-question').innerHTML = (question
      ? '<h3 tabindex="-1">'+escape(question.prompt)+'</h3><div class="atlas40-choices">'+
        Object.entries(question.values).map(([key,label]) =>
          '<button type="button" data-atlas-answer="'+key+'">'+escape(answerLabels[current]?.[key] || label)+'</button>').join('')+
        '<button type="button" id="atlas40-skip">Не уверен · пропустить</button></div>'
      : '<h3 tabindex="-1">Уточнение завершено</h3>') +
      '<div class="atlas40-choices atlas40-history">'+
      '<button type="button" id="atlas40-back" '+(history.length?'':'disabled')+'>Назад</button>'+
      '<button type="button" id="atlas40-reset" '+(history.length?'':'disabled')+'>Начать заново</button>'+
      '<button type="button" data-atlas-term="gills">Словарь признаков</button></div>'+
      (summary ? '<ul class="atlas40-answers">'+summary+'</ul>' : '');

    const results = byId('atlas40-results');
    results.innerHTML = '';
    if (selected) {
      const cards = result.ranked.slice(0,shown).map(({item,matched,unknown}) => {
        const danger = item.risk==='смертельно-ядовитый' || item.risk==='ядовитый';
        const labels = keys => escape(keys.map(key => atlas.questions[key].label.toLowerCase()).join(', '));
        return '<article class="p20-hit"><h4>'+escape(item.name)+'</h4><i>'+escape(item.latin)+'</i>'+
          (danger ? '<strong class="atlas40-danger">'+escape(item.risk)+'</strong>' : '')+
          '<p><b>Совпало:</b> '+labels(matched)+'</p>'+
          (unknown.length ? '<p><b>Уточнить:</b> '+labels(unknown)+'</p>' : '')+
          '<button type="button" data-open="'+escape(item.id)+'">Открыть карточку</button></article>';
      }).join('');
      const summary = result.ranked.length
        ? (selected===1?'Недостаточно признаков для уверенного сравнения. ':'')+'Карточек с совпадениями: '+result.ranked.length
        : 'Сочетание признаков не найдено. Можно вернуться и уточнить ответы.';
      results.innerHTML = '<p role="status">'+summary+'</p>'+
        (result.undocumented ? '<p class="muted">У '+result.undocumented+' карточек нет сведений для проверки выбранных признаков.</p>' : '')+
        (result.excluded.length?'<details><summary>Есть противоречия в '+result.excluded.length+' карточках</summary><ul>'+
          result.excluded.map(row=>'<li><b>'+escape(row.item.name)+'</b> · '+row.conflicts.map(key=>
            escape(atlas.questions[key].label)+': в атласе «'+escape(atlas.labelValue(key,row.profile[key]))+'»').join(', ')+'</li>').join('')+
          '</ul></details>':'')+
        '<div class="p20-results">'+cards+'</div>'+
        (result.ranked.length>shown ? '<button type="button" id="atlas40-more">Показать ещё</button>' : '');
    }
    if (focus) byId('atlas40-question').querySelector('h3').focus();
  }
  host.addEventListener('change',event=>{
    const key=event.target.dataset.atlasEdit;
    if(!key)return;
    const step=history.find(x=>x.key===key);
    step.value=event.target.value;
    shown=8;
    render();
    host.querySelector('[data-atlas-edit="'+key+'"]').focus();
  });
  host.addEventListener('click',event => {
    const control = event.target.closest('button');
    if (!control) return;
    const answer = control.dataset.atlasAnswer;
    if (answer || control.id==='atlas40-skip') history.push({key:current,value:answer});
    else if (control.id==='atlas40-back') history.pop();
    else if (control.id==='atlas40-reset') history.length=0;
    else if (control.id==='atlas40-more') {
      const firstNew = shown;
      shown += 8;
      render();
      byId('atlas40-results').querySelectorAll('[data-open]')[firstNew]?.focus();
      return;
    } else return;
    shown = 8;
    render(true);
  });
  render();
})();
