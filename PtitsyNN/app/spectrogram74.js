'use strict';
/* MoOLVa 7.4: true short-time FFT spectrogram. Renders signal-derived
 * frequency energy only, on the user's computer. No network or AI inference.
 * First 45 seconds displayed; explicitly states truncation. */
(function(){
 const $=s=>document.querySelector(s);
 const canvas=$('#birdAISpectrogram'),message=$('#birdAISpectrogramStatus'),time=$('#birdAISpectrogramTime');
 if(!canvas)return;
 const c=canvas.getContext('2d',{alpha:false});
 const N=1024,LEVELS=110,WIDTH=640,MAX_SECONDS=45;
 let selectedAudio=null,duration=0,displayed=0,clipStart=0;
 const fft=(real,imag)=>{
  for(let i=1,j=0;i<N;i++){
   let bit=N>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;
   if(i<j){[real[i],real[j]]=[real[j],real[i]];[imag[i],imag[j]]=[imag[j],imag[i]];}
  }
  for(let len=2;len<=N;len<<=1){
   const ang=-2*Math.PI/len,wr=Math.cos(ang),wi=Math.sin(ang);
   for(let i=0;i<N;i+=len){
    let u=1,v=0;for(let j=0;j<len/2;j++){
     const a=i+j,b=a+len/2,ar=real[b]*u-imag[b]*v,ai=real[b]*v+imag[b]*u;
     real[b]=real[a]-ar;imag[b]=imag[a]-ai;real[a]+=ar;imag[a]+=ai;
     const nu=u*wr-v*wi;v=u*wi+v*wr;u=nu;
    }
   }
  }
 };
 function paintSamples(data,rate,start,dur){
  const w=WIDTH,h=LEVELS;
  canvas.width=w;canvas.height=h;
  const pixels=c.createImageData(w,h);
  const re=new Float32Array(N),im=new Float32Array(N);
  for(let col=0;col<w;col++){
   const center=Math.floor((start+(col+.5)*dur/w)*rate);
   let rms=0;
   for(let j=0;j<N;j++){
    const index=Math.min(Math.max(0,center-N/2+j),data.length-1);
    const value=(data[index]||0)*(0.5-0.5*Math.cos(2*Math.PI*j/(N-1)));
    re[j]=value;im[j]=0;rms+=value*value;
   }
   fft(re,im);
   for(let row=0;row<h;row++){
    // Frequency scale approximately logarithmic (200–13 000 Hz).
    const hz=200*Math.pow(65,(h-row)/h);
    const bin=Math.min(N/2-1,Math.max(0,Math.round(hz*N/rate)));
    const power=Math.hypot(re[bin],im[bin]);
    const level=Math.max(0,Math.min(1,(20*Math.log10(power+1e-6)+16)/60));
    const v=Math.pow(level,1.55),p=(row*w+col)*4;
    pixels.data[p]=Math.round(5+226*Math.pow(v,1.9));
    pixels.data[p+1]=Math.round(16+168*v);
    pixels.data[p+2]=Math.round(31+186*Math.sin(v*Math.PI*.72));
    pixels.data[p+3]=255;
   }
  }
  c.putImageData(pixels,0,0);
  c.fillStyle='#fff';c.font='11px sans-serif';c.fillText('до '+Math.round(dur)+' сек · 200 Гц–13 кГц · реальный FFT',10,16);
 }
 async function render(file,audio){
  selectedAudio=audio;clipStart=0;
  if(!file){c.clearRect(0,0,canvas.width,canvas.height);if(message)message.textContent='Выберите звуковой файл';return;}
  if(message)message.textContent='Строю спектрограмму по реальному звуковому сигналу…';
  const context=new (window.AudioContext||window.webkitAudioContext)();
  try{
   const buffer=await context.decodeAudioData(await file.arrayBuffer());
   if(!buffer.length)throw new Error('Файл не содержит звуковых отсчётов');
   duration=buffer.duration;displayed=Math.min(duration,MAX_SECONDS);
   const signal=buffer.getChannelData(0);
   paintSamples(signal,buffer.sampleRate,0,displayed);
   if(message)message.textContent='Спектрограмма первых '+displayed.toFixed(1)+' с'+''+'. Кликните по изображению, чтобы прослушать соответствующий момент. '+(duration>displayed?'Остальная часть записи не показана.':'');
  }catch(e){if(message)message.textContent='Не удалось построить спектрограмму: '+(e.message||String(e));}
  finally{await context.close();}
 }
 canvas.addEventListener('click',event=>{
  if(!selectedAudio||!displayed)return;
  const bounds=canvas.getBoundingClientRect();
  if(bounds.width<=0)return;
  const frac=Math.max(0,Math.min(1,(event.clientX-bounds.left)/bounds.width));
  const t=clipStart+frac*displayed;
  selectedAudio.currentTime=Math.min(Math.max(0,duration-.05),t);
  selectedAudio.play().catch(()=>{});
  if(time)time.textContent='Прослушивание: '+t.toFixed(1)+' с';
 });
 window.BirdSpectrogram74={render};
})();