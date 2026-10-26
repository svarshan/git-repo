'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('BirdAI',{
 status:()=>ipcRenderer.invoke('birdai-status'),
 diagnostics:()=>ipcRenderer.invoke('birdai-diagnostic'),
 enableMicrophone:()=>ipcRenderer.invoke('birdai-microphone-intent'),
 analyze:(pcm)=>{
  if(!(pcm instanceof Float32Array)||pcm.length!==160000)
   return Promise.reject(new Error('Нужны 5 секунд PCM при 32 кГц.'));
  return ipcRenderer.invoke('birdai-analyze',pcm);
 }
});

contextBridge.exposeInMainWorld('BirdVision',{
 status:()=>ipcRenderer.invoke('birdvision80-status'),
 diagnostics:()=>ipcRenderer.invoke('birdvision80-diagnostics'),
 predict:(bytes)=>{
  if(!(bytes instanceof Uint8Array)&&!(bytes instanceof ArrayBuffer))return Promise.reject(Error('Нужно локальное изображение'));
  if(bytes.byteLength>9*1024*1024)return Promise.reject(Error('Фото слишком большое'));
  return ipcRenderer.invoke('birdvision80-predict',bytes);
 }
});
