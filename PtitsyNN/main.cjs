'use strict';
const {app,BrowserWindow,shell,session,ipcMain,nativeImage}=require('electron');
const path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto');
const {registerVision80}=require('./vision80.cjs');
const evidenceArg=process.argv.find(a=>a.startsWith('--moolva-ci-capture-dir='));
const evidenceMode=process.env.MOOLVA_CI_EVIDENCE==='1'&&Boolean(evidenceArg);
if(evidenceMode)app.disableHardwareAcceleration();
let modelPromise=null,running=false;
let micAllowedUntil=0;
const isTrusted=(wc)=>{try{const url=new URL(wc.getURL());return url.protocol==='file:' && url.pathname.endsWith('/app/index.html');}catch{return false;}};
function assets(){
 const appDir=app.isPackaged
  ?path.join(__dirname.replace(/app\.asar$/, 'app.asar.unpacked'),'app','models')
  :path.join(__dirname,'app','models');
 return {file:path.join(appDir,'perch-v2-eastern-europe.onnx'),
  labels:path.join(appDir,'perch-v2-eastern-europe-labels.txt'),
  metadata:path.join(appDir,'model-provenance.json')};
}
function modelStatus(){
 const files=assets();
 const ok=Object.values(files).every(p=>fs.existsSync(p));
 return {available:ok,engine:'Perch v2 ONNX',offline:true,
  description:ok?'Локальная обученная модель готова к анализу.':'Файлы проверенной модели отсутствуют — распознавание отключено.',
  license:'Apache-2.0',attribution:'Google Research; justinchuby; tphakala'};
}
async function inferenceModel(){
 if(modelPromise)return modelPromise;
 const file=assets();
 if(!modelStatus().available)throw new Error('Модель не найдена в установленном приложении.');
 modelPromise=(async()=>{
  const ort=require('onnxruntime-node');
  const model=await ort.InferenceSession.create(file.file,{executionProviders:['cpu'],intraOpNumThreads:2,interOpNumThreads:1,graphOptimizationLevel:'all'});
  const labels=fs.readFileSync(file.labels,'utf8').replace(/^\ufeff/,'').trim().split(/\r?\n/);
  if(!model.inputNames.includes('inputs')||!model.outputNames.includes('label'))throw Error('Неподдерживаемый формат модели Perch v2.');
  const info=JSON.parse(fs.readFileSync(file.metadata,'utf8'));
  if(labels.length!==info.class_count)throw Error('Ошибка контрольных данных классов.');
  return {model,labels,ort};
 })().catch(e=>{modelPromise=null;throw e;});
 return modelPromise;
}
function candidates(logits,labels){
 if(!logits.length||logits.length!==labels.length)throw Error('Модель вернула некорректное число классов.');
 const valid=[];
 for(let i=0;i<logits.length;i++)if(Number.isFinite(logits[i]))valid.push([i,logits[i]]);
 valid.sort((a,b)=>b[1]-a[1]);
 const pick=valid.slice(0,8),max=pick[0]?.[1]??0;
 const sum=valid.reduce((n,x)=>n+Math.exp(x[1]-max),0);
 return pick.map(([i,v])=>({label:labels[i],score:Math.round(Math.exp(v-max)/sum*10000)/100})).filter(x=>x.score>0);
}
function window(){
 const w=new BrowserWindow({title:'MoOLVa 8.0 — Орнитологический интеллект',width:1480,height:920,minWidth:820,minHeight:580,backgroundColor:'#07101d',autoHideMenuBar:true,show:!evidenceMode,
  webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,offscreen:evidenceMode,preload:path.join(__dirname,'preload.cjs')}});
 w.webContents.on('will-navigate',e=>e.preventDefault());
 w.webContents.setWindowOpenHandler(({url})=>{try{
  const u=new URL(url);
  if(u.protocol==='https:'&&/(^|\.)(wikimedia\.org|wikipedia\.org|gbif\.org|kerzhenskiy\.ru|oiseaux\.net|creativecommons\.org|apache\.org|huggingface\.co)$|^eco\.nobl\.ru$/.test(u.hostname))shell.openExternal(url);
 }catch{}return {action:'deny'};});
 w.loadFile(path.join(__dirname,'app','index.html'));
 return w;
}
/* Screenshot evidence is captured by the actually packaged Electron executable,
 * on a clean Windows CI runner with offscreen Chromium rendering (not HTML mockups).
 * Opt-in requires BOTH a CLI output directory and explicit CI environment flag. */
async function captureReleaseEvidence(win){
 const out=path.resolve(evidenceArg.slice('--moolva-ci-capture-dir='.length));
 fs.mkdirSync(out,{recursive:true});
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 try{
  if(!app.isPackaged)throw Error('Capture must run from a packaged Windows executable, not dev Electron');
  if(win.webContents.isLoading())await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('GUI initial load timeout')),45000);
   win.webContents.once('did-finish-load',()=>{clearTimeout(timer);resolve();});
   win.webContents.once('did-fail-load',(_e,_code,msg)=>{clearTimeout(timer);reject(Error(msg));});
  });
  await win.webContents.executeJavaScript('document.fonts.ready.then(()=>true)');
  const data=await win.webContents.executeJavaScript("({species:window.__APP_TEST__?.species||0,realImages:window.BIRDS_DATA?.filter(x=>!!x.imageFile).length||0,title:document.title})");
  if(data.species!==298||data.realImages<250)throw Error('Catalog not loaded correctly in actual packaged app: '+JSON.stringify(data));
  const pages=[
   ['01-glavnaya.png','catalog'],['02-bird-ai.png','birdai'],
   ['03-karta-oblasti.png','map'],['04-encyclopedia.png','articles'],
   ['05-polevoi-dnevnik.png','journal'],['06-audiolaboratoriya.png','lab'],['07-intelligence-center.png','intelligence80']
  ];
  const captured=[];
  for(const [name,view] of pages){
   const result=await win.webContents.executeJavaScript(`(async()=>{
    const button=document.querySelector('aside.sidebar button[data-view="${view}"]');
    if(!button)throw Error('Missing navigation button: ${view}');
    button.click();
    const node=document.getElementById('${view}');
    if(!node||node.hidden)throw Error('Section is not visible: ${view}');
    await document.fonts.ready;
    return {view:'${view}',visible:!node.hidden,heading:node.querySelector('h1')?.textContent?.slice(0,100)||''};
   })()`);
   await pause(view==='map'?1700:1000);
   const img=await win.webContents.capturePage();
   const bytes=img.toPNG(),dimensions=img.getSize();
   if(dimensions.width<800||dimensions.height<500||bytes.length<20000)throw Error('Screenshot invalid: '+name+' '+bytes.length+' bytes');
   fs.writeFileSync(path.join(out,name),bytes);
   captured.push({...result,name,bytes:bytes.length,width:dimensions.width,height:dimensions.height,
    sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
   process.stdout.write('REAL PACKAGED WINDOW SCREENSHOT '+name+' '+bytes.length+' bytes\\n');
  }
  const visionSmoke=await win.webContents.executeJavaScript('window.BirdVision?.diagnostics()');
  if(!visionSmoke?.ok||visionSmoke.classes<200)throw Error('Real local image model did not pass native ONNX inference');
  const evidence={type:'MoOLVa-real-windows-screenshots',version:require('./package.json').version,
   runtime:'Electron packaged Windows executable',captureMethod:'Chromium webContents.capturePage (offscreen)',
   os:process.platform,packaged:app.isPackaged,modelAvailable:modelStatus().available,visionModelVerified:visionSmoke,catalog:data,
   screenshots:captured,createdAt:new Date().toISOString()};
  if(!evidence.modelAvailable)throw Error('Offline Perch v2 files absent in executable');
  fs.writeFileSync(path.join(out,'gui-smoke.json'),JSON.stringify(evidence,null,2),'utf8');
  app.exit(0);
 }catch(error){
  fs.writeFileSync(path.join(out,'gui-smoke-error.txt'),String(error?.stack||error),'utf8');
  process.stderr.write('REAL GUI CAPTURE FAILURE: '+String(error?.stack||error)+'\\n');
  app.exit(1);
 }
}

app.whenReady().then(()=>{
 registerVision80({app,ipcMain,nativeImage,isTrusted});
 session.defaultSession.setPermissionRequestHandler((wc,permission,callback,details)=>{
  const mediaTypes=Array.isArray(details?.mediaTypes)?details.mediaTypes:[];
  const audioOnly=!mediaTypes.includes('video')&&(mediaTypes.length===0||mediaTypes.includes('audio'));
  callback(permission==='media'&&audioOnly&&isTrusted(wc)&&Date.now()<micAllowedUntil);
 });
 session.defaultSession.setPermissionCheckHandler((wc,permission,_origin,details)=>{
  if(permission!=='media')return false;
  if(details?.mediaType==='video')return false;
  return isTrusted(wc)&&Date.now()<micAllowedUntil;
 });
 ipcMain.handle('birdai-microphone-intent',event=>{
  if(!isTrusted(event.sender))throw Error('Недоверенный источник микрофона');
  micAllowedUntil=Date.now()+30000;
  return true;
 });
 ipcMain.handle('birdai-status',()=>modelStatus());
 // Exercises the native Electron ONNX runtime, not a mocked browser result.
 ipcMain.handle('birdai-diagnostic',async event=>{
  if(!isTrusted(event.sender))throw Error('Недоверенный источник');
  const started=Date.now();
  const modelInfo=modelStatus();
  if(!modelInfo.available)return {ok:false,description:modelInfo.description,model:'Google Perch v2 ONNX'};
  try{
   const {model,labels,ort}=await inferenceModel();
   const samples=new Float32Array(160000);
   for(let i=0;i<samples.length;i++)samples[i]=0.02*Math.sin(2*Math.PI*700*i/32000);
   const output=await model.run({inputs:new ort.Tensor('float32',samples,[1,160000])},['label']);
   const scores=output.label?.data;
   if(!scores||scores.length!==labels.length||!Array.from(scores).some(Number.isFinite))
    throw Error('Нейросеть вернула неполные или некорректные данные');
   return {ok:true,model:'Google Perch v2 ONNX',classCount:labels.length,elapsedMs:Date.now()-started,
    description:'Настоящая локальная модель загружена и рассчитала тестовый пятисекундный фрагмент. Это технический тест, а не проверка точности распознавания птиц.'};
  }catch(e){
   return {ok:false,description:'Ошибка локального ONNX-инференса: '+(e.message||String(e)),model:'Google Perch v2 ONNX',elapsedMs:Date.now()-started};
  }
 });
 ipcMain.handle('birdai-analyze',async(event,pcm)=>{
  if(!isTrusted(event.sender))throw Error('Недоверенный источник');
  if(running)throw Error('Предыдущая запись ещё анализируется.');
  if(!(pcm instanceof Float32Array||Array.isArray(pcm))||pcm.length!==160000)throw Error('Нужна запись длиной пять секунд, 32 кГц.');
  const values=new Float32Array(pcm);
  for(const v of values)if(!Number.isFinite(v)||Math.abs(v)>1.2)throw Error('Некорректные цифровые аудиоданные.');
  running=true;
  try{
   const {model,ort,labels}=await inferenceModel();
   const result=await model.run({inputs:new ort.Tensor('float32',values,[1,160000])},['label']);
   const score=result.label?.data;
   if(!score)throw Error('Нейросеть не вернула прогноз.');
   return {results:candidates(score,labels),model:'Google Perch v2, eastern Europe',
    caveat:'Оценки относительны в пределах региональной модели, без независимой калибровки. Результат требует проверки.'};
  }finally{running=false;}
 });
 const firstWindow=window();if(evidenceMode)void captureReleaseEvidence(firstWindow);
 app.on('activate',()=>{if(!evidenceMode&&BrowserWindow.getAllWindows().length===0)window();});
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
