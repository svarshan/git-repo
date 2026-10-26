'use strict';
/* Real MIT EfficientNet 525-class bird classifier using ONNX CPU.
 * No net calls, no template/color-matching masquerading as AI.
 * Dataset labels are NOT silently equated to 298 regional taxa. */
const path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto');
function registerVision80({app,ipcMain,nativeImage,isTrusted}){
 const dir=app.isPackaged?path.join(__dirname.replace(/app\.asar$/,'app.asar.unpacked'),'app','models'):path.join(__dirname,'app','models');
 const binary=path.join(dir,'birdvision-efficientnet-525.onnx');
 const provenance=path.join(dir,'birdvision-525-provenance.json');
 let sessionPromise=null;
 function meta(){if(!fs.existsSync(binary)||!fs.existsSync(provenance))return null;
  try{const m=JSON.parse(fs.readFileSync(provenance,'utf8'));
   return m?.sha256==='dbfd1293e47384cc215f3cbf0a611548589b91d5fd5e8838a03fdd485bd7151b'&&Array.isArray(m.labels)&&m.labels.length>=200?m:null;
  }catch{return null;}
 }
 function status(){const m=meta();return {available:!!m,offline:true,engine:'EfficientNet ONNX',model:'525 species (external training dataset)',classCount:m?.labels.length||0,
  scope:'Внешний классификатор на 525 классах. Не гарантирует охват 298 видов регионального атласа.',license:'MIT',
  description:m?'Настоящая локальная модель изображения готова. Результат нужно проверять вручную.':'Проверенная локальная модель Bird Vision отсутствует. AI-анализ отключён.'};}
 async function model(){
  if(sessionPromise)return sessionPromise;
  sessionPromise=(async()=>{
   const m=meta();if(!m)throw Error('Не найдена проверенная модель Bird Vision и сведения о происхождении.');
   const hashed=crypto.createHash('sha256');
   await new Promise((resolve,reject)=>{const f=fs.createReadStream(binary);f.on('data',d=>hashed.update(d));f.on('end',resolve);f.on('error',reject);});
   if(hashed.digest('hex')!==m.sha256)throw Error('Контрольная сумма модели изображения не совпадает с источником.');
   const ort=require('onnxruntime-node');
   const session=await ort.InferenceSession.create(binary,{executionProviders:['cpu'],intraOpNumThreads:2,interOpNumThreads:1,graphOptimizationLevel:'all'});
   if(session.inputNames.length!==1||session.outputNames.length<1)throw Error('Неожиданная структура входов/выходов модели.');
   return {session,ort,m};
  })().catch(err=>{sessionPromise=null;throw err;});
  return sessionPromise;
 }
 function pixelTensor(image,metadata,ort){
  const target=224,original=nativeImage.createFromBuffer(Buffer.from(image));
  if(original.isEmpty())throw Error('Не удалось декодировать настоящее изображение.');
  const dims=original.getSize();
  if(Math.max(dims.width,dims.height)>7000||Math.min(dims.width,dims.height)<20)throw Error('Фото слишком большое или слишком маленькое.');
  const bitmap=original.resize({width:target,height:target,quality:'best'}).toBitmap();
  if(bitmap.length!==target*target*4)throw Error('Неверный формат BGRA изображения.');
  const processor=metadata.processor||{};
  const means=processor.image_mean,stdev=processor.image_std;
  if(!Array.isArray(means)||!Array.isArray(stdev)||means.length!==3||stdev.length!==3||stdev.some(x=>!(x>0)))throw Error('Отсутствуют проверенные коэффициенты обработки изображения.');
  const rescale=processor.do_rescale===false?1:Number(processor.rescale_factor??(1/255));
  const vals=new Float32Array(3*target*target),area=target*target;
  for(let p=0;p<area;p++){
   const k=p*4; // Electron toBitmap uses BGRA
   vals[p]=(bitmap[k+2]*rescale-means[0])/stdev[0];
   vals[area+p]=(bitmap[k+1]*rescale-means[1])/stdev[1];
   vals[area*2+p]=(bitmap[k]*rescale-means[2])/stdev[2];
  }
  return new ort.Tensor('float32',vals,[1,3,target,target]);
 }
 async function predict(bytes){
  if(!(bytes instanceof Uint8Array||bytes instanceof ArrayBuffer)||bytes.byteLength>9*1024*1024||bytes.byteLength<128)throw Error('Нужно локальное изображение до 9 МБ.');
  const {session,ort,m}=await model();
  const input=pixelTensor(bytes,m,ort);
  const outputs=await session.run({[session.inputNames[0]]:input});
  const tensor=outputs[session.outputNames[0]],values=tensor?.data;
  if(!values||values.length!==m.labels.length)throw Error('Модель вернула неправильное число классов: '+(values?.length??0));
  const data=Array.from(values,(score,index)=>({score:Number(score),index})).filter(x=>Number.isFinite(x.score));
  if(data.length!==m.labels.length)throw Error('Некорректные оценки модели.');
  data.sort((a,b)=>b.score-a.score);
  return {model:m.model,classes:m.labels.length,source:m.source,top:data.slice(0,8).map(x=>({label:m.labels[x.index],score:x.score})),
   caveat:'Это относительные логиты модели из внешнего набора 525 видов, не калиброванные вероятности; многие региональные виды модель может не знать.'};
 }
 ipcMain.handle('birdvision80-status',event=>{if(!isTrusted(event.sender))throw Error('Недоверенная вкладка');return status();});
 ipcMain.handle('birdvision80-diagnostics',async event=>{
  if(!isTrusted(event.sender))throw Error('Недоверенная вкладка');
  const {session,ort,m}=await model();
  const input=new ort.Tensor('float32',new Float32Array(3*224*224),[1,3,224,224]);
  const output=await session.run({[session.inputNames[0]]:input});
  const raw=output[session.outputNames[0]]?.data;
  if(!raw||raw.length!==m.labels.length)throw Error('Реальная модель не вернула классы.');
  return {ok:true,classes:m.labels.length,input:session.inputNames[0],output:session.outputNames[0],offline:true};
 });
 ipcMain.handle('birdvision80-predict',async(event,bytes)=>{
  if(!isTrusted(event.sender))throw Error('Недоверенная вкладка');
  return predict(bytes);
 });
 return {status};
}
module.exports={registerVision80};
