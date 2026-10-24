'use strict';
/* MoOLVa 6.0: actual pretrained ONNX predictions, local 5 s PCM, 32 kHz.
   No model -> no fake inference. Client receives only ranked model logits. */
(function(){
const $=s=>document.querySelector(s);
const birds=Array.isArray(window.BIRDS_DATA)?window.BIRDS_DATA:[];
const normalize=s=>String(s||'').toLocaleLowerCase('ru').replace(/ё/g,'е').trim();
const root=$('#birdAI');
if(!root)return;
const filePicker=$('#birdAIFile'),go=$('#birdAIRun'),status=$('#birdAIStatus'),
      results=$('#birdAIResults'),preview=$('#birdAIPreview');
let file=null,busy=false;
const ct=(tag,text,cls)=>{const el=document.createElement(tag);if(text!=null)el.textContent=String(text);if(cls)el.className=cls;return el;};
const model=window.BirdAI;
async function verifyModel(){
 if(!model){
  status.textContent='Механизм локального распознавания доступен только в настольном EXE с установленным модулем Perch.';
  go.disabled=true;return;
 }
 try{
  const s=await model.status();
  status.textContent=s.description+' · '+s.engine+' · лицензия '+s.license;
  go.disabled=!s.available;
 }catch(e){
  status.textContent='Сервис локальной модели недоступен: '+e.message;
  go.disabled=true;
 }
}
function matchBird(label){
 const text=normalize(label).replace(/_/g,' ');
 const latin=birds.find(b=>text===normalize(b.latin)||text.includes(normalize(b.latin))||normalize(b.latin).includes(text));
 return latin||null;
}
function render(output){
 results.replaceChildren();
 const caption=ct('p',output.model+'. '+output.caveat,'living-note');results.appendChild(caption);
 for(const row of (output.results||[]).slice(0,7)){
  const b=matchBird(row.label),card=ct('article',null,'ai6-result');
  const score=Number(row.score)||0;
  const header=ct('strong',b?b.name:row.label);
  card.appendChild(header);
  card.appendChild(ct('small',(b?b.latin+' · ':'')+
    'Относительная оценка модели: '+score.toFixed(2)+'%. Не подтверждённая вероятность.'));
  if(b){
   const photo=b.imageFile?ct('img',null):null;
   if(photo){photo.src=b.imageFile;photo.alt='Фото '+b.name;photo.loading='lazy';card.insertBefore(photo,card.firstChild);}
   const link=ct('button','Открыть паспорт птицы','living-button');
   link.type='button';link.dataset.open=b.id;card.appendChild(link);
  }else card.appendChild(ct('p','Класс отсутствует в региональном справочнике MoOLVa.','living-note'));
  results.appendChild(card);
 }
 if(!output.results?.length)results.appendChild(ct('p','Нейросеть не выдала классов. Попробуйте другую запись.'));
}
async function pcmFiveSeconds(blob){
 const context=new (window.AudioContext||window.webkitAudioContext)();
 try{
  const buffer=await context.decodeAudioData(await blob.arrayBuffer());
  if(buffer.duration<.75)throw Error('Запись должна длиться не менее 0,75 секунды.');
  const sourceRate=buffer.sampleRate;
  const maxLength=Math.min(buffer.length,sourceRate*40);
  const samples=buffer.getChannelData(0);
  // Choose a loud non-silent 5-second region, not always the start of the file.
  const windowLength=Math.min(maxLength,Math.floor(sourceRate*5));
  let bestOffset=0,best=-1;
  for(let from=0;from+windowLength<=maxLength;from+=Math.max(1,Math.floor(sourceRate*1.5))){
   let energy=0;
   for(let i=from;i<from+windowLength;i+=Math.max(1,Math.round(sourceRate/600))){
    const v=samples[i];energy+=v*v;
   }
   if(energy>best){best=energy;bestOffset=from;}
  }
  if(best<=1e-5)throw Error('Запись слишком тихая для распознавания.');
  const offline=new OfflineAudioContext(1,160000,32000);
  const src=offline.createBufferSource();src.buffer=buffer;src.connect(offline.destination);
  src.start(0,bestOffset/sourceRate,Math.min(5,buffer.duration-bestOffset/sourceRate));
  const rendered=await offline.startRendering();
  const raw=rendered.getChannelData(0);
  const copy=new Float32Array(160000);
  copy.set(raw.subarray(0,Math.min(raw.length,copy.length)));
  return copy;
 }finally{await context.close();}
}
filePicker?.addEventListener('change',()=>{
 file=filePicker.files?.[0]||null;results.replaceChildren();
 preview.replaceChildren();
 if(!file)return;
 if(!['audio/wav','audio/x-wav','audio/mpeg','audio/ogg','audio/mp3','audio/flac'].includes(file.type) &&
    !/\.(wav|mp3|ogg|flac)$/i.test(file.name)){
  status.textContent='Нужен WAV, MP3, OGG или FLAC. Формат должен декодироваться в Windows.';file=null;return;
 }
 if(file.size>32_000_000){status.textContent='Максимальный размер файла 32 МБ.';file=null;return;}
 const p=ct('p',file.name+' · '+(file.size/1_000_000).toFixed(1)+' МБ. Запись будет обработана локально.','living-note');
 preview.appendChild(p);
 verifyModel();
});
go?.addEventListener('click',async()=>{
 if(!file||busy||!model)return;
 busy=true;go.disabled=true;results.replaceChildren();
 status.textContent='Готовлю звуковой фрагмент (5 секунд, 32 кГц), затем запускаю локальную модель…';
 try{
  const pcm=await pcmFiveSeconds(file);
  const output=await model.analyze(pcm);
  render(output);
  status.textContent='Анализ завершён на компьютере. Проверяйте совпадение по фотографиям и голосам.';
 }catch(e){
  status.textContent='Модель не смогла обработать файл: '+(e.message||String(e))+'. Результаты не подменяются догадками.';
 }finally{busy=false;go.disabled=false;}
});
verifyModel();
})();
