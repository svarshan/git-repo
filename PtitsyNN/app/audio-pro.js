'use strict';
(function(){
const active=new Set(),KEY='ptitsy-nn.audio-reports.v1';
const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;};
const add=(parent,...children)=>{for(const x of children)parent.appendChild(x);return parent;};
const stamp=x=>Number.isFinite(x)&&x>=0?Math.floor(x/60)+':'+String(Math.floor(x%60)).padStart(2,'0'):'0:00';
function stopAll(){for(const a of active){try{a.pause();a.currentTime=0;}catch{}}}
function reports(){try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x:[];}catch{return [];}}
function report(b,reason){
 const r=reports();
 r.push({bird:b.name,latin:b.latin,source:(b.audioCredits||{}).source||'',reason,date:new Date().toISOString()});
 try{localStorage.setItem(KEY,JSON.stringify(r.slice(-2000)));return true;}catch{return false;}
}
function exportReports(){
 const blob=new Blob([JSON.stringify({app:'MoOLVa Birds NN',version:'2.5',reports:reports()},null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=make('a');
 a.href=url;a.download='ptitsy-nn-audio-reports.json';document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),3000);
}
function player(b){
 const root=make('section','audio-pro');
 root.appendChild(make('div','audio-pro-title',b.name+' · '+b.latin));
 if(!b.audioFile){root.appendChild(make('p','audio-pro-muted','Для этого вида нет лицензированной записи. Голос другой птицы не подставляется.'));return root;}
 const audio=make('audio');audio.src=b.audioFile;audio.preload='metadata';audio.preservesPitch=true;active.add(audio);
 const play=make('button','audio-pro-play','▶ Воспроизвести');play.type='button';
 const seek=make('input','audio-pro-timeline');seek.type='range';seek.min='0';seek.max='1000';seek.value='0';seek.step='1';seek.setAttribute('aria-label','Перемотка');
 const clock=make('output','audio-pro-time','0:00 / 0:00');
 add(root,add(make('div','audio-pro-primary'),play,seek,clock));
 const speed=make('select','audio-pro-speed');speed.setAttribute('aria-label','Скорость');
 for(const v of ['0.75','1','1.25','1.5']){const opt=make('option','',v+'×');opt.value=v;opt.selected=v==='1';speed.appendChild(opt);}
 const volume=make('input','audio-pro-volume');volume.type='range';volume.min='0';volume.max='100';volume.value='100';volume.step='5';volume.setAttribute('aria-label','Громкость');
 const loop=make('input');loop.type='checkbox';loop.setAttribute('aria-label','Повтор');
 const label=(text,control)=>add(make('label','audio-pro-label',text+' '),control);
 add(root,add(make('div','audio-pro-options'),label('Громкость',volume),label('Скорость',speed),label('Повтор',loop)));
 const credit=b.audioCredits||{};
 root.appendChild(make('p','audio-pro-muted','Источник: '+(credit.author||'не указан')+' · '+(credit.license||'не указана')+'. Вид определён по метаданным; не проверен прослушиванием специалиста.'));
 if(credit.source&&/^https:\/\/(commons\.wikimedia\.org\/|xeno-canto\.org\/|freesound\.org\/|archive\.org\/)/.test(credit.source)){
  const link=make('a','audio-pro-source','Открыть источник ↗');link.href=credit.source;link.target='_blank';link.rel='noopener noreferrer';root.appendChild(link);
 }
 const select=make('select','audio-pro-problem');
 for(const [val,name] of [['quiet','Слишком тихо'],['speech','Разговоры людей'],['wrong','Не тот вид птицы'],['noise','Посторонний шум'],['other','Другое']]){
  const o=make('option','',name);o.value=val;select.appendChild(o);
 }
 const flag=make('button','audio-pro-report','Отметить проблему');flag.type='button';
 const result=make('span','audio-pro-muted','');
 add(root,add(make('div','audio-pro-feedback'),select,flag,result));
 function refresh(){
  const d=audio.duration||0,p=audio.currentTime||0;
  clock.textContent=stamp(p)+' / '+stamp(d);
  seek.value=d>0?String(Math.round(p/d*1000)):'0';
  play.textContent=audio.paused?'▶ Воспроизвести':'Ⅱ Пауза';
 }
 play.addEventListener('click',()=>{if(audio.paused){stopAll();audio.play().catch(()=>{result.textContent='Ошибка воспроизведения';refresh();});}else audio.pause();});
 audio.addEventListener('play',()=>{for(const other of active){if(other!==audio)other.pause();}refresh();});
 for(const name of ['loadedmetadata','timeupdate','pause','ended'])audio.addEventListener(name,refresh);
 audio.addEventListener('error',()=>{result.textContent='Нет доступного аудиофайла';});
 seek.addEventListener('input',()=>{if(Number.isFinite(audio.duration)&&audio.duration>0)audio.currentTime=audio.duration*Number(seek.value)/1000;});
 speed.addEventListener('change',()=>{audio.playbackRate=Number(speed.value)||1;});
 volume.addEventListener('input',()=>{audio.volume=Math.max(0,Math.min(1,Number(volume.value)/100));});
 loop.addEventListener('change',()=>{audio.loop=loop.checked;});
 flag.addEventListener('click',()=>{result.textContent=report(b,select.value)?'Отмечено. Отчёт доступен для экспорта.':'Не удалось сохранить';});
 return root;
}
function mountCard(host,bird){if(!host)return;stopAll();host.replaceChildren(player(bird));}
function mountCompare(host,birds,prefer){
 if(!host)return;
 stopAll();host.replaceChildren();
 const options=birds.filter(b=>b.audioFile);
 if(options.length<2){host.appendChild(make('p','audio-pro-muted','Нужно минимум две записи для сравнения.'));return;}
 const selectors=[],panels=[];
 const toolbar=make('div','compare-toolbar'),grid=make('div','compare-grid');
 for(let i=0;i<2;i++){
  const select=make('select','compare-select');select.setAttribute('aria-label',i===0?'Первая птица':'Вторая птица');
  for(const b of options){const op=make('option','',b.name+' · '+b.latin);op.value=b.id;select.appendChild(op);}
  const label=add(make('label','compare-select-label',i===0?'Первая птица':'Вторая птица'),select);
  toolbar.appendChild(label);selectors.push(select);
  const panel=make('div','compare-slot');panels.push(panel);grid.appendChild(panel);
 }
 selectors[0].value=options.find(b=>b.id===prefer)?.id||options[0].id;
 selectors[1].value=options.find(b=>b.id!==selectors[0].value)?.id||options[1].id;
 const download=make('button','audio-pro-report','Скачать отчёт о проблемных записях');download.type='button';download.addEventListener('click',exportReports);
 add(host,toolbar,grid,make('p','audio-pro-muted','Записи воспроизводятся по очереди. Оригинальные файлы доступны без интернета; изменение скорости сохраняет высоту звука.'),download);
 const refresh=changed=>{
  let a=options.find(b=>b.id===selectors[0].value)||options[0];
  let b=options.find(b=>b.id===selectors[1].value)||options[1];
  if(a.id===b.id){if(changed===1)a=options.find(x=>x.id!==b.id);else b=options.find(x=>x.id!==a.id);}
  selectors[0].value=a.id;selectors[1].value=b.id;
  stopAll();panels[0].replaceChildren(player(a));panels[1].replaceChildren(player(b));
 };
 selectors[0].addEventListener('change',()=>refresh(0));
 selectors[1].addEventListener('change',()=>refresh(1));
 refresh(0);
}
window.BirdAudioPro={stopAll,mountCard,mountCompare,exportReports};
})();