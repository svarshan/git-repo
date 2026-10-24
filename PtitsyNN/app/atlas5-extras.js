'use strict';
/* MoOLVa 5.0: local authentic bird-song training and recoverable offline backups. */
(function(){
const $=q=>document.querySelector(q);
const catalog=Array.isArray(window.BIRDS_DATA)?window.BIRDS_DATA:[];
const byId=new Map(catalog.map(b=>[b.id,b]));
const voiceBirds=catalog.filter(b=>b.audioFile&&b.name);
const quizRoot=$('#academyAudioQuiz'),quizScore=$('#academyAudioScore');
const KEY='ptitsy-nn.academy.sound.v5';
const ARCHIVE='MoOLVa-Atlas-Backup';
const SAVED={
 journal:'ptitsy-nn.journal.v1',
 favorites:'ptitsy-nn.favorites.v1',
 settings:'ptitsy-nn.ui3.settings.v1',
 photoAcademy:'ptitsy-nn.academy.v1',
 soundAcademy:KEY,
 recent:'ptitsy-nn.recent.v1'
};
function safeRead(k,def){
 try{const x=JSON.parse(localStorage.getItem(k));return x==null?def:x;}catch{return def;}
}
function node(tag,text,className){
 const element=document.createElement(tag);
 if(text!=null)element.textContent=String(text);
 if(className)element.className=className;return element;
}
function button(text,fn){
 const b=node('button',text,'living-button');b.type='button';b.addEventListener('click',fn);return b;
}
function choices(pool,size){
 const arr=pool.slice();
 for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}
 return arr.slice(0,size);
}
let audio=null;
function stopAudio(){if(audio){audio.pause();audio.removeAttribute('src');audio.load();audio=null;}}
function showScore(){
 const score=safeRead(KEY,{asked:0,correct:0});
 if(quizScore)quizScore.textContent='Вопросов: '+(score.asked||0)+' · правильных: '+(score.correct||0);
}
function audioQuestion(){
 if(!quizRoot)return;
 stopAudio();quizRoot.replaceChildren();
 if(voiceBirds.length<4){
  quizRoot.appendChild(node('p','Недостаточно проверенных записей для этого упражнения.'));
  return;
 }
 const answer=choices(voiceBirds,1)[0];
 const options=choices(voiceBirds.filter(b=>b.id!==answer.id),3).concat(answer);
 const order=choices(options,4);
 const prompt=node('p','Нажмите воспроизведение, послушайте запись и выберите птицу.');
 quizRoot.appendChild(prompt);
 audio=node('audio');audio.controls=true;audio.preload='none';audio.src=answer.audioFile;
 audio.setAttribute('aria-label','Прослушайте настоящую запись птицы');quizRoot.appendChild(audio);
 const grid=node('div',null,'living-quiz-choices'),result=node('p',null);result.setAttribute('role','status');
 quizRoot.append(grid,result);
 for(const b of order){
  grid.appendChild(button(b.name,()=>{
   stopAudio();
   const correct=b.id===answer.id;const score=safeRead(KEY,{asked:0,correct:0});
   score.asked=(Number(score.asked)||0)+1;score.correct=(Number(score.correct)||0)+(correct?1:0);
   try{localStorage.setItem(KEY,JSON.stringify(score));}catch{}
   showScore();
   result.textContent=correct?'Правильно: '+answer.name+'.':'Ответ: '+answer.name+'. Можете открыть паспорт и изучить голос.';
   for(const x of grid.querySelectorAll('button'))x.disabled=true;
   const reveal=button('Открыть паспорт вида',()=>{
    document.querySelector('nav [data-view="catalog"]')?.click();
    const hidden=node('button');hidden.dataset.open=answer.id;hidden.hidden=true;document.body.appendChild(hidden);hidden.click();hidden.remove();
   });
   quizRoot.append(reveal,button('Следующая запись →',audioQuestion));
  }));
 }
}
showScore();audioQuestion();
document.addEventListener('click',e=>{
 if(e.target.closest('[data-view]') && !e.target.closest('[data-view="academy"]'))stopAudio();
});
const exportStatus=$('#atlas5BackupStatus');
function verifyJournal(a){
 if(!Array.isArray(a)||a.length>20000)return false;
 return a.every(x=>x&&typeof x.id==='string'&&x.id.length<=160&&byId.has(x.birdId)&&
  typeof x.place==='string'&&x.place.length>0&&x.place.length<=160&&
  typeof x.date==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(x.date)&&
  Number.isInteger(x.count)&&x.count>=1&&x.count<=99999&&
  (x.notes==null||typeof x.notes==='string'&&x.notes.length<=2000));
}
function validate(data){
 if(!data||data.kind!==ARCHIVE||data.schema!==1||!data.payload||
    typeof data.payload!=='object'||Array.isArray(data.payload))throw Error('Неверный формат архива MoOLVa.');
 const p=data.payload, journal=p.journal??[],favorites=p.favorites??[];
 if(!verifyJournal(journal))throw Error('Некорректные наблюдения в архиве.');
 if(!Array.isArray(favorites)||favorites.length>catalog.length||
    !favorites.every(id=>typeof id==='string'&&byId.has(id)))throw Error('Некорректный список избранного.');
 for(const name of ['settings','photoAcademy','soundAcademy']){
  const x=p[name];if(x!=null&&(typeof x!=='object'||Array.isArray(x)||Object.keys(x).length>30))throw Error('Некорректные настройки/достижения.');
 }
 if(p.recent!=null&&(!Array.isArray(p.recent)||p.recent.length>50||!p.recent.every(id=>typeof id==='string'&&id.length<160)))throw Error('Некорректная история.');
 return {journal,favorites,settings:p.settings||{},photoAcademy:p.photoAcademy||{done:0,right:0},
  soundAcademy:p.soundAcademy||{asked:0,correct:0},recent:p.recent||[]};
}
function exportBackup(){
 const payload={};
 for(const [name,key] of Object.entries(SAVED))payload[name]=safeRead(key,name==='journal'||name==='favorites'||name==='recent'?[]:{});
 const backup={kind:ARCHIVE,schema:1,exportedAt:new Date().toISOString(),app:'MoOLVa 5.0',
  reminder:'Contains private places and notes from the local journal. Keep private.',payload};
 const url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json;charset=utf-8'}));
 const a=node('a');a.href=url;a.download='MoOLVa-5.0-Full-Backup-'+new Date().toISOString().slice(0,10)+'.json';
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
 if(exportStatus)exportStatus.textContent='Архив сохранён на этом устройстве. В нём могут быть личные заметки и места — храните файл конфиденциально.';
}
$('#atlas5Backup')?.addEventListener('click',exportBackup);
$('#atlas5Restore')?.addEventListener('click',()=>$('#atlas5BackupFile')?.click());
$('#atlas5BackupFile')?.addEventListener('change',async e=>{
 const file=e.target.files?.[0];e.target.value='';
 if(!file)return;
 try{
  if(file.size>5_000_000)throw Error('Файл превышает 5 МБ.');
  const content=JSON.parse(await file.text()),clean=validate(content);
  if(!confirm('Архив прошёл проверку. Заменить текущий дневник, избранное и настройки? Сначала рекомендуется экспортировать текущий архив.'))return;
  const originals=Object.fromEntries(Object.values(SAVED).map(k=>[k,localStorage.getItem(k)]));
  try{
   for(const [name,key] of Object.entries(SAVED))localStorage.setItem(key,JSON.stringify(clean[name]));
  }catch(err){
   for(const [k,old] of Object.entries(originals)){try{if(old===null)localStorage.removeItem(k);else localStorage.setItem(k,old);}catch{}}
   throw Error('Не удалось сохранить восстановленные данные.');
  }
  if(exportStatus)exportStatus.textContent='Архив восстановлен, интерфейс будет обновлён.';
  location.reload();
 }catch(err){if(exportStatus)exportStatus.textContent='Восстановление отменено: '+err.message;}
});
})();
