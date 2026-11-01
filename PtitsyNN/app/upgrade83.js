'use strict';
/* MoOLVa 8.3: visually inspect genuine offline media. Human checks are not auto-certified. */
(function(){
 const root=document.getElementById('media83'),core=window.MoOLVa83Core;
 if(!root||!core)return;
 const birds=Array.isArray(window.BIRDS_DATA)?window.BIRDS_DATA:[];
 const key='ptitsy-nn.media83.review.v1';
 const $=s=>root.querySelector(s);
 const button=(label,handler)=>{
  const x=document.createElement('button');x.type='button';x.textContent=label;x.addEventListener('click',handler);return x;
 };
 const div=(tag,cls,content)=>{
  const n=document.createElement(tag);if(cls)n.className=cls;if(content!==undefined)n.textContent=content;return n;
 };
 const get=()=>{
  try{const v=JSON.parse(localStorage.getItem(key));if(core.validReview(v))return v;}catch{}
  return {version:1,photo:{},audio:{}};
 };
 let review=get(),offset=0;
 const say=message=>{$('#m83Status').textContent=message;};
 const safeLink=(url,label)=>{
  if(!/^https:\/\/[a-z0-9.-]+\//i.test(url||''))return div('span','m83-small','Ссылка на первоисточник отсутствует');
  const a=div('a',null,label);a.href=url;a.target='_blank';a.rel='noreferrer noopener';return a;
 };
 function mark(b,kind,answer){
  review[kind][b.id]=answer;
  try{localStorage.setItem(key,JSON.stringify(review));say((answer==='confirmed'?'Подтверждено вами: ':'Помечено для перепроверки: ')+b.name+'.');render();}
  catch(e){say('Не удалось сохранить локальную проверку: '+e.message);}
 }
 function counts(){
  const metrics=$('#m83Metrics');metrics.replaceChildren();
  const checks=[
   ['Видов',birds.length],['Настоящие аудиофайлы',birds.filter(b=>b.audioFile).length],
   ['Фото с файлами',birds.filter(b=>b.imageFile).length],
   ['Фото просмотрено вами',Object.values(review.photo).filter(x=>x==='confirmed').length],
   ['Аудио прослушано вами',Object.values(review.audio).filter(x=>x==='confirmed').length],
   ['Требует проверки',Object.values(review.audio).filter(x=>x==='questioned').length+Object.values(review.photo).filter(x=>x==='questioned').length]];
  for(const [name,val] of checks){
   const x=div('div');x.append(div('strong',null,String(val)),div('span',null,name));metrics.append(x);
  }
 }
 function filtered(){
  const q=$('#m83Search').value.trim(),type=$('#m83Filter').value;
  let rows=core.search(birds,q,{limit:298});
  if(type==='noaudio')rows=rows.filter(b=>!b.audioFile);
  if(type==='notreviewed')rows=rows.filter(b=>(b.audioFile&&review.audio[b.id]!=='confirmed')||(b.imageFile&&review.photo[b.id]!=='confirmed'));
  if(type==='questioned')rows=rows.filter(b=>review.audio[b.id]==='questioned'||review.photo[b.id]==='questioned');
  if(type==='audio')rows=rows.filter(b=>b.audioFile);
  return rows;
 }
 function card(b){
  const m=core.mediaStatus(b,review),item=div('article','m83-card');
  if(m.photo){
   const im=div('img');im.src=b.imageFile;im.alt='Фото вида '+b.name;im.loading='lazy';im.onerror=()=>{im.replaceWith(div('p','m83-muted','Не удалось открыть фотографию'));};item.append(im);
  }else item.append(div('p','m83-muted','Нет проверенного файла фотографии'));
  item.append(div('h3',null,b.name),div('p','m83-small',b.latin||''));
  const credit=(label,source,license,author)=>{
   const p=div('p');p.append(div('strong',null,label+': '),document.createTextNode((license||'лицензия не указана')+' · '+(author||'автор не указан')+' · '),safeLink(source,'Источник'));item.append(p);
  };
  if(m.photo)credit('Фото',m.photoSource,m.photoLicense,b.imageCredits?.author);
  if(m.audio)credit('Голос',m.audioSource,m.audioLicense,b.audioCredits?.author);
  if(m.audio){const audio=div('audio');audio.controls=true;audio.preload='none';audio.src=b.audioFile;item.append(audio);}
  else item.append(div('p','m83-muted','Звукозаписи нет. Ничем не подменена.'));
  item.append(div('p','m83-small','Фото: '+(m.photoHuman?'подтверждено вами':m.photoQuestioned?'сомнительно':'ещё не просмотрено')+' · Голос: '+(m.audioHuman?'прослушан вами':m.audioQuestioned?'сомнительно':'не прослушан вами')));
  const actions=div('div','m83-actions');
  if(m.photo)actions.append(button('Фото верное',()=>mark(b,'photo','confirmed')),button('Фото сомнительно',()=>mark(b,'photo','questioned')));
  if(m.audio)actions.append(button('Прослушал: верно',()=>mark(b,'audio','confirmed')),button('Голос сомнителен',()=>mark(b,'audio','questioned')));
  item.append(actions);
  return item;
 }
 function render(){
  counts();const rows=filtered(),list=$('#m83List');list.replaceChildren();
  offset=Math.max(0,Math.min(offset,Math.max(0,Math.ceil(rows.length/18)-1)*18));
  for(const b of rows.slice(offset,offset+18))list.append(card(b));
  if(!rows.length)list.append(div('p','m83-muted','Нет видов для этого фильтра'));
  $('#m83Page').textContent=rows.length?(offset+1)+'–'+Math.min(offset+18,rows.length)+' из '+rows.length:'0 видов';
  $('#m83Prev').disabled=offset===0;$('#m83Next').disabled=offset+18>=rows.length;
 }
 async function inspectBackups(){
  const target=$('#m83BackupList');target.replaceChildren();
  if(!window.MoOLVaBackup?.list){say('Проверка резервных копий недоступна');return;}
  try{
   const rows=await window.MoOLVaBackup.list();
   const ok=rows.filter(x=>x.valid).length;
   target.append(div('p','m83-muted','Найдено резервных архивов: '+rows.length+' · прошли проверку SHA-256: '+ok+'. Хранятся только локально.'));
   for(const row of rows.slice(0,12)){
    target.append(div('p','m83-small',(row.valid?'✓ ':'⚠ ')+row.name+(row.valid?' · '+Math.round(row.bytes/1024)+' КБ':' · повреждён или неподдерживаемый')));
   }
   if(!rows.length)target.append(div('p','m83-muted','Архивов пока нет. Нажмите «Сделать резервную копию».'));
  }catch(error){say('Не удалось проверить копии: '+error.message);}
 }
 $('#m83CheckBackups').addEventListener('click',inspectBackups);
 $('#m83OpenFolder').addEventListener('click',async()=>{
  try{await window.MoOLVaBackup.openFolder();say('Папка локальных резервных копий открыта. Для переноса используйте экспорт полного архива в настройках.');}
  catch(error){say('Папка недоступна: '+error.message);}
 });
 $('#m83Search').addEventListener('input',()=>{offset=0;render();});
 $('#m83Filter').addEventListener('change',()=>{offset=0;render();});
 $('#m83Prev').addEventListener('click',()=>{offset=Math.max(0,offset-18);render();});
 $('#m83Next').addEventListener('click',()=>{offset+=18;render();});
 $('#m83Export').addEventListener('click',()=>{
  const data=JSON.stringify({type:'moolva-human-media-review83',exportedAt:new Date().toISOString(),review},null,2);
  const blob=new Blob([data],{type:'application/json'}),link=document.createElement('a'),url=URL.createObjectURL(blob);
  link.href=url;link.download='MoOLVa-8.3-human-review.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
  say('Ваши отметки выгружены в отдельный JSON. Это не экспертный орнитологический сертификат.');
 });
 $('#m83Backup').addEventListener('click',async()=>{
  const b=$('#m83Backup');b.disabled=true;
  try{const result=await window.MoOLVaAutoBackup?.create('manual');if(!result?.saved)throw Error('Локальный архив не подтверждён');say('Резервная копия создана: '+result.file);await inspectBackups();}
  catch(e){say('Ошибка резервирования: '+(e.message||e));}
  finally{b.disabled=false;}
 });
 const city=$('#m83Town'),cities=Array.isArray(window.MOOLVA_SETTLEMENTS)?window.MOOLVA_SETTLEMENTS:[];
 for(const t of cities.slice().sort((a,b)=>a.name.localeCompare(b.name,'ru'))){
  if(!Number.isFinite(Number(t.lat))||!Number.isFinite(Number(t.lon)))continue;
  const option=div('option',null,t.name);option.value=t.name;city.append(option);
 }
 $('#m83Nearby').addEventListener('click',()=>{
  const found=cities.find(x=>x.name===city.value),cells=window.HABITAT_DATA?.cells||[];
  const rows=core.nearbyEvidence(cells,found,Number($('#m83Radius').value),$('#m83Season').value,birds).slice(0,16);
  const target=$('#m83NearbyResults');target.replaceChildren();
  if(!rows.length){target.append(div('p','m83-muted','В опубликованных данных нет подходящих записей для выбранных условий. Это не означает, что птиц здесь нет.'));return;}
  target.append(div('p','m83-muted','Данные из укрупнённых зон опубликованных наблюдений: не текущая геопозиция и не места гнездования.'));
  for(const row of rows){const p=div('p');const open=button(row.bird.name,()=>window.BirdHabitat?.focusSpecies(row.bird.id));p.append(open,document.createTextNode(' · '+row.reports+' сообщений · '+row.zones+' зон'));target.append(p);}
 });
 document.querySelectorAll('nav [data-view="media83"]').forEach(b=>b.addEventListener('click',render));
 window.MoOLVa83Media={render,review:()=>get()};
 render();
})();
