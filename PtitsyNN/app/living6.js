'use strict';
/* MoOLVa 7.4: Perch v2 ONNX real offline inference across up to 12 independent 5s windows.
 * Recorded microphone audio stays in-memory on the device. No fabricated scores. */
(function(){
const $=s=>document.querySelector(s);
const root=$('#birdAI');if(!root)return;
const birds=Array.isArray(window.BIRDS_DATA)?window.BIRDS_DATA:[];
const filePicker=$('#birdAIFile'),run=$('#birdAIRun'),status=$('#birdAIStatus');
const results=$('#birdAIResults'),preview=$('#birdAIPreview');
const mic=$('#birdAIMic'),stop=$('#birdAIStop'),duration=$('#birdAIDuration'),recStatus=$('#birdAIRecordingStatus');
const diagnostics=$('#birdAIDiagnostics'),diagnosticsStatus=$('#birdAIDiagnosticsStatus');
const model=window.BirdAI;
const norm=s=>String(s||'').toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/_/g,' ').trim();
const node=(tag,text,cls)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined&&text!==null)el.textContent=String(text);return el;};
let file=null,busy=false,recording=false,recorder=null,stream=null,finishTimer=null,startAt=0,previewUrl=null;
let modelReady=false,activeAudio=null,stopClip=null;
const put=(text)=>{if(status)status.textContent=text;};
const recordingText=t=>{if(recStatus)recStatus.textContent=t;};
function disableButtons(){
 if(run)run.disabled=busy||recording||!file||!modelReady;
 if(mic)mic.disabled=busy||recording||!model;
 if(stop)stop.disabled=!recording;
}
function birdFor(label){
 const t=norm(label);
 return birds.find(b=>t===norm(b.latin)||t.startsWith(norm(b.latin)+' ')||t.includes(' '+norm(b.latin)+' '))||null;
}
async function verify(){
 if(!model){put('Perch v2 доступен только в Windows EXE с установленным ONNX-модулем.');modelReady=false;disableButtons();return;}
 try{
  const s=await model.status();modelReady=Boolean(s.available);
  put(s.description+' · '+s.engine+' · лицензия '+s.license+' · для проверки реальной работы нажмите «Проверить Bird AI».');
 }catch(e){modelReady=false;put('Не удаётся проверить Perch v2: '+(e.message||String(e)));}
 disableButtons();
}
function setFile(next,fromMic){
 if(busy)return;
 file=next;results?.replaceChildren();if(stopClip){stopClip();stopClip=null;}if(activeAudio)activeAudio.pause();activeAudio=null;preview?.replaceChildren();
 if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}
 if(!next){disableButtons();return;}
 if(next.size>32*1024*1024){file=null;put('Максимальный размер записи 32 МБ.');disableButtons();return;}
 if(!fromMic && !/\.(wav|mp3|ogg|flac|webm)$/i.test(next.name)){
  file=null;put('Поддерживаются WAV, MP3, OGG и FLAC.');disableButtons();return;
 }
 preview?.append(node('p',next.name+' · '+(next.size/1048576).toFixed(1)+' МиБ · данные останутся на компьютере','living-note'));
 previewUrl=URL.createObjectURL(next);
 const audio=node('audio');audio.controls=true;audio.preload='none';audio.src=previewUrl;preview?.append(audio);activeAudio=audio;
 window.BirdSpectrogram74?.render(next,audio).catch(e=>{const box=$('#birdAISpectrogramStatus');if(box)box.textContent='Спектрограмма недоступна: '+(e.message||String(e));});
 disableButtons();verify();
}
filePicker?.addEventListener('change',()=>setFile(filePicker.files?.[0]||null,false));
diagnostics?.addEventListener('click',async()=>{
 if(!model?.diagnostics){
  if(diagnosticsStatus)diagnosticsStatus.textContent='Механизм проверки отсутствует: нужен новый Windows EXE MoOLVa 7.4, а не старый веб-просмотр.';
  return;
 }
 diagnostics.disabled=true;
 if(diagnosticsStatus)diagnosticsStatus.textContent='Загружаю Google Perch v2 и выполняю реальный ONNX-расчёт на процессоре Windows…';
 try{
  const res=await model.diagnostics();
  if(diagnosticsStatus)diagnosticsStatus.textContent=(res.ok?'✓ Bird AI работает. ':'✕ Bird AI не готов. ')+res.description+
   (res.ok?' · классов модели: '+res.classCount+' · время: '+res.elapsedMs+' мс':'');
  if(res.ok){modelReady=true;disableButtons();}
  else{modelReady=false;disableButtons();}
 }catch(e){
  modelReady=false;disableButtons();
  if(diagnosticsStatus)diagnosticsStatus.textContent='Ошибка связи с модулем Bird AI: '+(e.message||String(e));
 }finally{diagnostics.disabled=false;}
});

function cleanUpRecorder(){
 if(finishTimer){clearTimeout(finishTimer);finishTimer=null;}
 stream?.getTracks()?.forEach(t=>t.stop());stream=null;recorder=null;recording=false;
 disableButtons();
}
async function microphoneStart(){
 if(recording||busy||!model)return;
 if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){recordingText('Микрофон или MediaRecorder недоступен на этом компьютере.');return;}
 try{
  await model.enableMicrophone();
  const newStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
  stream=newStream;
  const preferred=['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported(t));
  const r=new MediaRecorder(stream,preferred?{mimeType:preferred}:undefined),parts=[];
  recorder=r;
  r.ondataavailable=ev=>{if(ev.data?.size)parts.push(ev.data);};
  r.onerror=()=>{recordingText('Ошибка записи микрофона');cleanUpRecorder();};
  r.onstop=()=>{
   const type=r.mimeType||parts[0]?.type||'audio/webm';
   const output=new File(parts,['bird-recording-'+new Date().toISOString().replace(/[:.]/g,'-')+'.webm'].join(''),{type});
   cleanUpRecorder();
   recordingText('Запись завершена: '+Math.round((Date.now()-startAt)/1000)+' с.');
   if(output.size)setFile(output,true);else put('Микрофон не записал звук.');
  };
  startAt=Date.now();recording=true;r.start(500);disableButtons();
  recordingText('Идёт запись; остановите её кнопкой. Микрофон активен.');
  finishTimer=setTimeout(()=>microphoneStop(),(Number(duration?.value)||30)*1000);
 }catch(e){cleanUpRecorder();recordingText('Нет доступа к микрофону: '+(e.message||String(e)));}
}
function microphoneStop(){
 if(!recording||!recorder)return;
 try{if(recorder.state!=='inactive')recorder.stop();else cleanUpRecorder();}
 catch(e){recordingText('Не удалось завершить запись: '+(e.message||String(e)));cleanUpRecorder();}
}
mic?.addEventListener('click',microphoneStart);
stop?.addEventListener('click',microphoneStop);
window.addEventListener('beforeunload',()=>{if(recorder?.state==='recording')recorder.stop();cleanUpRecorder();if(previewUrl)URL.revokeObjectURL(previewUrl);});
async function windowsFromFile(blob){
 const context=new (window.AudioContext||window.webkitAudioContext)();
 try{
  const buffer=await context.decodeAudioData(await blob.arrayBuffer());
  if(buffer.duration<.75)throw Error('Запись короче 0,75 секунды.');
  const durationSeconds=Math.min(600,buffer.duration);
  // Cover the entire first 10 minutes with at most 12 sampled 5-second windows.
  const segment=5;
  const count=Math.max(1,Math.min(12,Math.ceil(durationSeconds/segment)));
  const range=Math.max(0,durationSeconds-segment);
  const offsets=Array.from({length:count},(_,i)=>count===1?0:Math.round((range*i/(count-1))*1000)/1000);
  const windows=[];
  for(const offset of offsets){
   const offline=new OfflineAudioContext(1,160000,32000),src=offline.createBufferSource();
   src.buffer=buffer;src.connect(offline.destination);
   src.start(0,offset,Math.max(.001,Math.min(segment,buffer.duration-offset)));
   const raw=(await offline.startRendering()).getChannelData(0);
   let energy=0;
   for(let i=0;i<raw.length;i+=320)energy+=raw[i]*raw[i];
   if(energy/500<.0000001)continue;
   windows.push({offset,pcm:new Float32Array(raw)});
  }
  if(!windows.length)throw Error('В записи не найдено достаточно слышимого сигнала.');
  return {windows,totalSeconds:buffer.duration,truncated:buffer.duration>600};
 }finally{await context.close();}
}
function playClip(offset){
 if(!activeAudio)return;
 if(stopClip){stopClip();stopClip=null;}
 let stopped=false;const end=offset+5;
 const watch=()=>{if(activeAudio && activeAudio.currentTime>=end-.05){activeAudio.pause();clean();}};
 const clean=()=>{if(stopped)return;stopped=true;activeAudio?.removeEventListener('timeupdate',watch);};
 activeAudio.currentTime=Math.max(0,offset);
 activeAudio.addEventListener('timeupdate',watch);
 stopClip=clean;
 activeAudio.play().catch(()=>clean());
}
function showAnalysis(data,meta){
 results.replaceChildren();
 results.append(node('p','Google Perch v2 · '+meta.windows+' отдельных окон по 5 с. '+(meta.truncated?'Рассмотрены отдельные окна из первых 10 минут. ':'')+'Временные отметки показывают моменты, в которых модель выдала данный класс. Это не подтверждение присутствия птицы; оценки не калиброваны как вероятности.','living-note'));
 for(const prediction of data.slice(0,8)){
  const bird=birdFor(prediction.label),card=node('article',null,'ai6-result');
  if(bird?.imageFile){const img=node('img');img.loading='lazy';img.src=bird.imageFile;img.alt='Птица '+bird.name;card.append(img);}
  card.append(node('strong',bird?.name||prediction.label));
  card.append(node('small',(bird?.latin?bird.latin+' · ':'')+'Средняя относительная оценка модели: '+prediction.score.toFixed(2)+'%; фрагментов в топ-списке: '+prediction.hits+' из '+meta.windows));
  const moments=node('div',null,'ai74-times');
  for(const finding of (prediction.findings||[]).slice(0,7)){
    const play=node('button','▶ '+finding.offset.toFixed(1)+' с','ai74-timestamp');
    play.type='button';play.title='Прослушать 5 секунд около '+finding.offset.toFixed(1)+' с; модельная оценка '+finding.score.toFixed(1);
    play.addEventListener('click',()=>playClip(finding.offset));
    moments.append(play);
  }
  if(prediction.hits>7)moments.append(node('small','Ещё '+(prediction.hits-7)+' окон','living-note'));
  card.append(moments);
  if(bird){
   const row=node('div',null,'ai7-actions');
   const passport=node('button','Открыть паспорт','living-button');passport.type='button';passport.dataset.open=bird.id;
   const map=node('button','На карте','living-button');map.type='button';
   map.addEventListener('click',()=>window.BirdHabitat?.focusSpecies(bird.id));
   row.append(passport,map);card.append(row);
  }else card.append(node('small','Название не сопоставлено с региональным каталогом.','living-note'));
  results.append(card);
 }
 if(!data.length)results.append(node('p','Модель не смогла выделить убедительные классы из записи.','living-note'));
}
async function analyse(){
 if(busy||recording||!file||!modelReady)return;
 busy=true;disableButtons();results.replaceChildren();put('Декодирую аудио на компьютере…');
 try{
  const {windows,totalSeconds,truncated}=await windowsFromFile(file),combined=new Map();
  for(let i=0;i<windows.length;i++){
   put('Google Perch v2 · анализ '+(i+1)+' из '+windows.length+' (около '+windows[i].offset.toFixed(1)+' с записи)…');
   const response=await model.analyze(windows[i].pcm);
   for(const x of response.results||[]){
    if(!Number.isFinite(x.score)||typeof x.label!=='string')continue;
    const prev=combined.get(x.label)||{sum:0,hits:0,findings:[]};
    prev.sum+=x.score;prev.hits++;prev.findings.push({offset:windows[i].offset,score:x.score});
    combined.set(x.label,prev);
   }
  }
  const predictions=[...combined].map(([label,p])=>({label,score:p.sum/windows.length,hits:p.hits,findings:p.findings.sort((a,b)=>a.offset-b.offset)}))
   .sort((a,b)=>b.score-a.score).slice(0,8);
  showAnalysis(predictions,{windows:windows.length,totalSeconds,truncated});
  put('Локальное распознавание завершено. Сверяйте результаты с фотографиями, голосами и картой.');
 }catch(e){put('Не удалось распознать запись: '+(e.message||String(e))+'. Результаты не подменяются догадками.');}
 finally{busy=false;disableButtons();}
}
run?.addEventListener('click',analyse);
verify();
})();