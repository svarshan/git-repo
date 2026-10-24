'use strict';
/* MoOLVa 2.9 Field Assistant — entirely offline, no invented taxonomic traits.
   Finder uses audited names/groups/text only. "Same group" is a catalog similarity, not scientific ID.
*/
(function(){
const $=s=>document.querySelector(s);
const make=(tag,cls,label)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(label!==undefined)n.textContent=String(label);return n;};
const add=(p,...children)=>{for(const n of children)p.appendChild(n);return p;};
const KEY='ptitsy-nn.recent.v1',LIMIT=18;
const norm=s=>String(s??'').toLocaleLowerCase('ru').replace(/ё/g,'е').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim();
function recent(){
 try{const a=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(a)?a.filter(x=>typeof x==='string').slice(0,LIMIT):[];}catch{return [];}
}
function markRecent(id){
 const entries=[id,...recent().filter(x=>x!==id)].slice(0,LIMIT);
 try{localStorage.setItem(KEY,JSON.stringify(entries));}catch{}
}
function words(s){return norm(s).split(/[\s,.;]+/).filter(Boolean);}
function distance(a,b){
 if(Math.abs(a.length-b.length)>2)return 99;
 let previous=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){
  const curr=[i];
  for(let j=1;j<=b.length;j++)curr[j]=Math.min(curr[j-1]+1,previous[j]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));
  previous=curr;
 }
 return previous[b.length];
}
function score(b,q){
 if(!q)return 0;
 const label=norm(b.name+' '+b.latin+' '+(b.group||''));
 if(label.includes(q))return label.startsWith(q)?0:1;
 const tokens=words(label),seek=words(q);
 if(!seek.length)return 0;
 const scores=seek.map(term=>{
  let best=99;
  for(const t of tokens){
   if(t.startsWith(term))best=Math.min(best,2);
   if(term.length>=4&&Math.abs(t.length-term.length)<=2)best=Math.min(best,3+distance(term,t));
  }
  return best;
 });
 return scores.every(n=>n<=5)?Math.max(...scores):99;
}
function render(root,birds,openBird){
 if(!root)return;
 const map=new Map(birds.map(b=>[b.id,b]));
 root.replaceChildren();
 const intro=make('div','field-card');
 add(intro,make('div','overline','ОФЛАЙН-ОПРЕДЕЛИТЕЛЬ ПО КАТАЛОГУ'),make('h2','field-panel-title','Найти птицу по описанию встречи'),
     make('p','field-muted','Поиск по русскому и научному названию, группе и доступным материалам. Программа предлагает варианты для сравнения; автоматическое распознавание по фотографии или голосу не выполняется.'));
 const controls=make('div','field-controls');
 const input=make('input');input.type='search';input.placeholder='Например: синица, дятел, Parus major';input.setAttribute('aria-label','Поиск по виду');
 const group=make('select');group.setAttribute('aria-label','Группа птиц');
 const groups=[...new Set(birds.map(b=>b.group||'Прочие птицы'))].sort((a,b)=>a.localeCompare(b,'ru'));
 for(const key of ['Все группы',...groups]){
  const opt=make('option','',key);opt.value=key==='Все группы'?'*':key;group.appendChild(opt);
 }
 const filter=make('select');filter.setAttribute('aria-label','Доступность материалов');
 for(const [k,name] of [['all','Все виды'],['photo','С фото'],['audio','С голосом'],['article','С подробной статьёй']]){const o=make('option','',name);o.value=k;filter.appendChild(o);}
 add(controls,input,group,filter);
 const summary=make('p','field-summary','');
 const results=make('div','field-result');
 add(intro,controls,summary,results);root.appendChild(intro);
 const compare=make('section','field-card');compare.id='field-compare';
 add(compare,make('h2','field-panel-title','Сравнение двух видов по доступным материалам'),
     make('p','field-muted','Выберите птиц из результатов поиска. Фотографии, описание и ссылки на первоисточники взяты из встроенного каталога.'));
 const selectrow=make('div','field-controls');
 const left=make('select'),right=make('select');
 for(const s of [left,right]){
  s.setAttribute('aria-label',s===left?'Первый вид':'Второй вид');
  for(const b of [...birds].sort((a,b)=>a.name.localeCompare(b.name,'ru'))){
   const o=make('option','',b.name+' · '+b.latin);o.value=b.id;s.appendChild(o);
  }
  selectrow.appendChild(s);
 }
 const compareGrid=make('div','field-compare');
 add(compare,selectrow,compareGrid);root.appendChild(compare);
 const last=make('section','field-card'),lastTitle=make('h2','field-panel-title','Недавно просмотренные птицы'),lastList=make('div','field-actions');
 last.id='field-recent';add(last,lastTitle,lastList);root.appendChild(last);
 function showLast(){
  lastList.replaceChildren();
  const entries=recent().map(id=>map.get(id)).filter(Boolean);
  if(!entries.length){lastList.appendChild(make('p','field-muted','Откройте несколько птиц в каталоге — они появятся здесь.'));return;}
  for(const b of entries){const button=make('button','',b.name);button.type='button';button.addEventListener('click',()=>openBird(b.id));lastList.appendChild(button);}
 }
 function drawCompare(){
  compareGrid.replaceChildren();
  for(const id of [left.value,right.value]){
   const b=map.get(id);
   if(!b)continue;
   const panel=make('article','field-card');
   const photo=make('div','field-photo');
   if(b.imageFile){const image=make('img');image.src=b.imageFile;image.alt='Фотография '+b.name;image.loading='lazy';photo.appendChild(image);}
   else photo.appendChild(make('p','field-muted','Фотография не найдена'));
   add(panel,photo,make('h3','field-panel-title',b.name),make('p','field-muted',b.latin+' · '+(b.group||'Прочие птицы')),
    make('p','field-muted',b.audioFile?'Есть настоящая звуковая запись':'Звуковая запись отсутствует'),
    make('p','field-muted',(b.description||'Подробных сведений пока нет.').slice(0,550)+(String(b.description||'').length>550?'…':'')));
   const button=make('button','primary','Открыть карточку');button.type='button';button.addEventListener('click',()=>openBird(b.id));panel.appendChild(button);
   compareGrid.appendChild(panel);
  }
 }
 function draw(){
  const q=norm(input.value),selection=birds.map(b=>({b,s:score(b,q)}))
    .filter(({b,s})=>s!==99&&(group.value==='*'||(b.group||'Прочие птицы')===group.value)
      &&(filter.value==='all'||filter.value==='photo'&&b.imageFile||filter.value==='audio'&&b.audioFile||filter.value==='article'&&b.articleComplete))
    .sort((a,b)=>a.s-b.s||a.b.name.localeCompare(b.b.name,'ru')).slice(0,48).map(x=>x.b);
  summary.textContent='Подходящих видов: '+birds.filter(b=>score(b,q)!==99&&(group.value==='*'||(b.group||'Прочие птицы')===group.value)
    &&(filter.value==='all'||filter.value==='photo'&&b.imageFile||filter.value==='audio'&&b.audioFile||filter.value==='article'&&b.articleComplete)).length+
    '. Показаны первые '+selection.length+'.';
  results.replaceChildren();
  if(!selection.length)results.appendChild(make('p','field-muted','Ничего не найдено. Уточните название или выберите другую группу.'));
  for(const b of selection){
   const card=make('article','field-card');
   const heading=make('h3','field-panel-title',b.name),latin=make('p','field-muted',b.latin+' · '+(b.group||''));
   const actions=make('div','field-actions'),open=make('button','', 'Карточка'),pickL=make('button','','⇄ Слева'),pickR=make('button','','⇄ Справа');
   open.type=pickL.type=pickR.type='button';
   open.addEventListener('click',()=>openBird(b.id));
   pickL.addEventListener('click',()=>{left.value=b.id;drawCompare();compare.scrollIntoView({behavior:'smooth',block:'start'});});
   pickR.addEventListener('click',()=>{right.value=b.id;drawCompare();compare.scrollIntoView({behavior:'smooth',block:'start'});});
   add(actions,open,pickL,pickR);
   if(b.imageFile){const photo=make('div','field-photo'),img=make('img');img.src=b.imageFile;img.loading='lazy';img.alt=b.name;photo.appendChild(img);card.appendChild(photo);}
   add(card,heading,latin,actions);results.appendChild(card);
  }
 }
 left.value=birds[0]?.id||'';right.value=birds[1]?.id||left.value;
 [input,group,filter].forEach(el=>el.addEventListener(el===input?'input':'change',draw));
 left.addEventListener('change',drawCompare);right.addEventListener('change',drawCompare);
 draw();drawCompare();showLast();
}
window.BirdFieldAssistant={render,markRecent,recent,score};
})();