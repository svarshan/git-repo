'use strict';
/* MoOLVa 4.0: honest offline field-tools, not a fabricated ML classifier. */
(function(){
const all=Array.isArray(window.BIRDS_DATA)?window.BIRDS_DATA:[];
const $=sel=>document.querySelector(sel);
const norm=s=>String(s||'').toLocaleLowerCase('ru').replace(/ё/g,'е');
const elements={};
const picks=all.filter(b=>b.imageFile&&b.name&&b.latin);
function button(text,fn,cls=''){
 const e=document.createElement('button');e.type='button';if(cls)e.className=cls;
 e.textContent=text;e.addEventListener('click',fn);return e;
}
function card(b){
 const el=document.createElement('article');el.className='living-card';
 if(b.imageFile){
  const img=document.createElement('img');img.src=b.imageFile;img.alt='Фотография '+b.name;img.loading='lazy';el.appendChild(img);
 }
 const info=document.createElement('div');info.className='living-card-info';
 const h=document.createElement('strong');h.textContent=b.name;
 const latin=document.createElement('small');latin.textContent=b.latin;
 const flags=document.createElement('span');flags.textContent=(b.audioFile?'♪ Запись есть':'♪ Нет записи')+' · '+(b.articleComplete?'Полная статья':'Краткая справка');
 info.append(h,latin,flags,button('Открыть подробности',()=>document.dispatchEvent(new CustomEvent('living-open',{detail:b.id})),'living-button'));
 el.appendChild(info);return el;
}
function makeOptions(select,ids){
 select.replaceChildren();
 const o=document.createElement('option');o.value='';o.textContent='Выберите вид';select.appendChild(o);
 for(const b of ids){
  const x=document.createElement('option');x.value=b.id;x.textContent=b.name+' · '+b.latin;select.appendChild(x);
 }
}
function queryAssistant(){
 const form=$('#livingAssistantForm'),out=$('#livingAssistantResults');
 if(!form||!out)return;
 const desc=$('#livingAssistantText');
 form.addEventListener('submit',e=>{
  e.preventDefault();const q=norm(desc.value).trim();
  out.replaceChildren();
  if(q.length<3){out.textContent='Уточните название, наблюдаемые признаки или тип местности.';return;}
  const terms=q.split(/[\s,.;!?]+/).filter(x=>x.length>=3);
  const items=all.map(b=>{
   const title=norm(b.name+' '+b.latin+' '+(b.group||''));
   const body=norm((b.description||'').slice(0,3500));
   const score=terms.reduce((n,t)=>n+(title.includes(t)?5:0)+(body.includes(t)?1:0),0);
   return {b,score};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,12);
  if(!items.length){out.textContent='Совпадений в текстовом каталоге нет. Определение не выполнено.';return;}
  const note=document.createElement('p');note.className='living-note';note.textContent='Подсказки на основе слов в проверенных описаниях, а не автоматическое определение. Похожие слова не доказывают вид.';out.appendChild(note);
  for(const x of items)out.appendChild(card(x.b));
 });
}
let currentPhoto=null;
function photoPanel(){
 const input=$('#livingPhotoFile'),preview=$('#livingPhotoPreview'),picker=$('#livingPhotoBird');
 if(!input||!preview||!picker)return;
 makeOptions(picker,all.filter(b=>b.imageFile).sort((a,b)=>a.name.localeCompare(b.name,'ru')));
 input.addEventListener('change',()=>{
  if(currentPhoto){URL.revokeObjectURL(currentPhoto);currentPhoto=null;}
  preview.replaceChildren();
  const file=input.files?.[0];if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>15_000_000){
   preview.textContent='Выберите JPEG, PNG или WebP до 15 МБ.';return;
  }
  currentPhoto=URL.createObjectURL(file);
  const img=document.createElement('img');img.src=currentPhoto;img.alt='Ваше фото, хранится локально';preview.appendChild(img);
 });
 picker.addEventListener('change',()=>{
  const b=all.find(x=>x.id===picker.value),area=$('#livingPhotoCompare');
  area.replaceChildren();if(!b)return;area.appendChild(card(b));
 });
 window.addEventListener('beforeunload',()=>{if(currentPhoto)URL.revokeObjectURL(currentPhoto);});
}
let objectAudio=null;
function soundPanel(){
 const input=$('#livingSoundFile'),player=$('#livingSoundPlayer'),picker=$('#livingSoundBird'),comp=$('#livingSoundCompare'),canvas=$('#livingWaveform');
 if(!input||!player||!picker)return;
 makeOptions(picker,all.filter(b=>b.audioFile).sort((a,b)=>a.name.localeCompare(b.name,'ru')));
 input.addEventListener('change',async()=>{
  if(objectAudio){URL.revokeObjectURL(objectAudio);objectAudio=null;}
  player.removeAttribute('src');canvas.hidden=true;
  const file=input.files?.[0];if(!file)return;
  if(!['audio/wav','audio/x-wav','audio/mpeg','audio/ogg','audio/mp3'].includes(file.type)||file.size>16_000_000){
   $('#livingSoundStatus').textContent='Поддерживаются WAV, MP3, OGG до 16 МБ.';return;
  }
  objectAudio=URL.createObjectURL(file);player.src=objectAudio;
  $('#livingSoundStatus').textContent='Запись загружена только в память программы. Сравните с эталоном на слух.';
  try{
   const AC=window.AudioContext||window.webkitAudioContext;
   if(!AC)return;
   const context=new AC(),decoded=await context.decodeAudioData(await file.arrayBuffer());
   const data=decoded.getChannelData(0),width=canvas.width,height=canvas.height;
   const ctx=canvas.getContext('2d');ctx.clearRect(0,0,width,height);
   ctx.strokeStyle='#5ad1ec';ctx.lineWidth=1.4;ctx.beginPath();
   for(let x=0;x<width;x++){
    const start=Math.floor(x*data.length/width),end=Math.floor((x+1)*data.length/width);
    let min=0,max=0;const stride=Math.max(1,Math.floor((end-start)/50));
    for(let j=start;j<end;j+=stride){min=Math.min(min,data[j]);max=Math.max(max,data[j]);}
    ctx.moveTo(x,Math.floor(height/2+min*height/2));ctx.lineTo(x,Math.floor(height/2+max*height/2));
   }ctx.stroke();canvas.hidden=false;await context.close();
  }catch{$('#livingSoundStatus').textContent+=' Визуализация недоступна для этого формата.';}
 });
 picker.addEventListener('change',()=>{
  const b=all.find(x=>x.id===picker.value);comp.replaceChildren();if(!b)return;
  const title=document.createElement('strong');title.textContent=b.name+' — оригинальная лицензированная запись';comp.appendChild(title);
  const audio=document.createElement('audio');audio.controls=true;audio.src=b.audioFile;audio.preload='none';comp.appendChild(audio);
  const link=button('Открыть карточку птицы',()=>document.dispatchEvent(new CustomEvent('living-open',{detail:b.id})),'living-button');comp.appendChild(link);
 });
 window.addEventListener('beforeunload',()=>{if(objectAudio)URL.revokeObjectURL(objectAudio);});
}
const quizKey='ptitsy-nn.academy.v1';
let quiz=null;
function nextQuestion(){
 const root=$('#livingQuiz');if(!root)return;root.replaceChildren();
 if(picks.length<4){root.textContent='Недостаточно проверенных изображений для викторины.';return;}
 const target=picks[Math.floor(Math.random()*picks.length)];
 const others=picks.filter(b=>b.id!==target.id).sort(()=>Math.random()-.5).slice(0,3);
 const choices=[target,...others].sort(()=>Math.random()-.5);
 quiz=target.id;
 const image=document.createElement('img');image.src=target.imageFile;image.alt='Определите птицу по фотографии';image.className='living-quiz-img';root.appendChild(image);
 const ask=document.createElement('h3');ask.textContent='Какая птица на фотографии?';root.appendChild(ask);
 const choicesEl=document.createElement('div');choicesEl.className='living-quiz-choices';root.appendChild(choicesEl);
 const feedback=document.createElement('p');feedback.setAttribute('role','status');root.appendChild(feedback);
 for(const b of choices)choicesEl.appendChild(button(b.name,()=>{
  const yes=b.id===quiz;feedback.textContent=yes?'Верно: '+target.name:'Это '+target.name+'. Попробуйте следующую.';
  for(const x of choicesEl.querySelectorAll('button'))x.disabled=true;
  let score={done:0,right:0};
  try{score={...score,...JSON.parse(localStorage.getItem(quizKey)||'{}')};}catch{}
  score.done++;if(yes)score.right++;try{localStorage.setItem(quizKey,JSON.stringify(score));}catch{}
  $('#livingQuizScore').textContent='Пройдено: '+score.done+' · правильных: '+score.right;
  root.appendChild(button('Следующий вопрос →',nextQuestion,'living-button'));
 },'living-button'));
}
function expedition(){
 $('#livingExport')?.addEventListener('click',()=>{
  let journal=[];try{const j=JSON.parse(localStorage.getItem('ptitsy-nn.journal.v1')||'[]');if(Array.isArray(j))journal=j;}catch{}
  const payload={kind:'MoOLVa-Expedition',version:1,exported:new Date().toISOString(),source:'MoOLVa Windows 4.0',observations:journal};
  const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='MoOLVa-Expedition-'+new Date().toISOString().slice(0,10)+'.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
  $('#livingExportStatus').textContent='Сохраните JSON в безопасном месте. Android-приложение и двусторонняя синхронизация пока не созданы.';
 });
}
queryAssistant();photoPanel();soundPanel();expedition();nextQuestion();
document.addEventListener('living-open',e=>{
 document.querySelector('nav [data-view="catalog"]')?.click();
 const btn=document.createElement('button');btn.dataset.open=String(e.detail);btn.hidden=true;
 document.body.appendChild(btn);btn.click();btn.remove();
});
})();
