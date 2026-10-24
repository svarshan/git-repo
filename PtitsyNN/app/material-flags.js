'use strict';
/* Offline information flags for every individual bird card.
   Natural bird recordings and Windows text-to-speech are different features. */
(function(){
  function flags(b){
    const voice=Boolean(b && b.audioFile);
    const full=Boolean(b && b.articleComplete);
    return [
      {kind:voice?'voice-yes':'voice-no',label:voice?'♪ Голос птицы: есть':'♪ Голос птицы: нет'},
      {kind:full?'article-yes':'article-brief',label:full?'▤ Описание: подробное':'▤ Описание: краткое'}
    ];
  }
  function markup(b){
    return '<div class="material-flags" aria-label="Доступные материалы">'+flags(b).map(f=>
      '<span class="material-flag '+f.kind+'">'+f.label+'</span>'
    ).join('')+'</div>';
  }
  function node(b){
    const root=document.createElement('div');
    root.className='material-flags';
    root.setAttribute('aria-label','Доступные материалы');
    for(const f of flags(b)){
      const span=document.createElement('span');
      span.className='material-flag '+f.kind;
      span.textContent=f.label;
      root.appendChild(span);
    }
    return root;
  }
  function excerpt(b,limit=125){
    const value=String(b && b.description || '').replace(/\s+/g,' ').trim();
    if(!value)return 'Описание пока не добавлено.';
    if(value.length<=limit)return value;
    const cut=value.slice(0,limit).replace(/\s+\S*$/,'').trim();
    return (cut||value.slice(0,limit)).trimEnd()+'…';
  }
  window.BirdMaterialFlags={flags,markup,node,excerpt};
})();
