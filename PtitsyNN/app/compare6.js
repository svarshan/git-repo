'use strict';
/* MoOLVa 6.0: factual side-by-side field comparison, no fabricated taxonomy. */
(function(){
const root=document.getElementById('speciesCompare6');if(!root)return;
const birds=Array.isArray(window.BIRDS_DATA)?window.BIRDS_DATA:[];
const byId=new Map(birds.map(b=>[b.id,b]));
const $=s=>root.querySelector(s);
const a=$('#speciesCompareA'),b=$('#speciesCompareB'),result=$('#speciesCompareResult');
const zones=window.HABITAT_DATA?.cells||[];
const hint=document.getElementById('m77CompareHint');
const toolbar=root.querySelector('.six-compare-toolbar');
if(toolbar){const recommend=document.createElement('button');recommend.type='button';recommend.className='living-button';
 recommend.textContent='Выбрать второй вид из того же рода / группы';
 recommend.addEventListener('click',()=>{
  const first=byId.get(a.value);if(!first)return;
  const genus=String(first.latin||'').split(' ')[0];
  const other=birds.find(x=>x.id!==first.id&&String(x.latin||'').split(' ')[0]===genus)
   ||birds.find(x=>x.id!==first.id&&x.group===first.group)
   ||birds.find(x=>x.id!==first.id);
  if(other){b.value=other.id;render();}
 });
 toolbar.appendChild(recommend);
}
const norm=s=>String(s||'').toLocaleLowerCase('ru').replace(/ё/g,'е');
const make=(tag,text,cls)=>{const x=document.createElement(tag);if(text!=null)x.textContent=String(text);if(cls)x.className=cls;return x;};
function select(sel){
 sel.replaceChildren(...birds.slice().sort((x,y)=>x.name.localeCompare(y.name,'ru')).map(b=>{
  const option=make('option',b.name+' — '+b.latin);option.value=b.id;return option;
 }));
}
function box(b){
 const item=make('article',null,'six-compare-card');
 if(b.imageFile){const image=make('img');image.src=b.imageFile;image.alt='Птица '+b.name;image.loading='lazy';item.appendChild(image);}
 else item.appendChild(make('p','Проверенная фотография отсутствует.','living-note'));
 const title=make('h3',b.name),latin=make('em',b.latin);
 item.append(title,latin);
 const atlas=zones.filter(z=>(z.species||[]).some(s=>s.id===b.id));
 const months=[...new Set(atlas.flatMap(z=>z.species.filter(s=>s.id===b.id).flatMap(s=>s.months||[])))].sort((x,y)=>x-y);
 const info=[
  ['Систематическая группа',b.group||'Нет сведений'],
  ['Пение / позывки',b.audioFile?'Проверенная запись есть':'Подходящая запись пока не найдена'],
  ['Материал статьи',b.articleComplete?'Расширенная статья':'Краткая справка'],
  ['Зоны GBIF',atlas.length],
  ['Месяцы с данными',months.length?months.join(', '):'Недостаточно сведений']
 ];
 const dl=make('dl',null,'six-compare-properties');
 for(const [heading,text] of info){dl.append(make('dt',heading),make('dd',text));}
 item.appendChild(dl);
 const excerpt=make('p',String(b.description||'Описание не найдено.').replace(/\s+/g,' ').slice(0,420)+(b.description?.length>420?'…':''),'living-note');
 item.appendChild(excerpt);
 if(b.audioFile){
  const title=make('strong','Подлинная запись голоса');
  const player=make('audio');player.controls=true;player.preload='none';player.src=b.audioFile;item.append(title,player);
 }
 const button=make('button','Открыть полный паспорт →','living-button');button.type='button';button.dataset.open=b.id;item.appendChild(button);
 return item;
}
function render(){
 result.replaceChildren();
 const left=byId.get(a.value),right=byId.get(b.value);if(!left||!right)return;
 if(left.id===right.id){result.textContent='Выберите два разных вида, чтобы увидеть различия.';return;}
 result.append(box(left),box(right));
 if(hint){
  const both=left.group===right.group?'Одна группа: '+(left.group||'группа не указана'):'Разные группы: '+(left.group||'не указана')+' / '+(right.group||'не указана');
  const sounds=' · Голоса: '+(left.audioFile?'есть':'нет')+' / '+(right.audioFile?'есть':'нет');
  hint.textContent=both+sounds+'. Доступные голоса и описания проверяйте по первоисточникам; отсутствие данных не доказывает различия.';
 }
}
select(a);select(b);
if(birds.length>1){a.value=birds[0].id;b.value=birds[1].id;}
a.addEventListener('change',render);b.addEventListener('change',render);render();
window.MoOLVaCompare6={selectSpecies:id=>{
 document.querySelector('nav [data-view="comparebirds6"]')?.click();
 if(byId.has(id))a.value=id;
 if(a.value===b.value){const other=birds.find(x=>x.id!==id);if(other)b.value=other.id;}
 render();
}};
})();
