'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('BirdAI',{
 status:()=>ipcRenderer.invoke('birdai-status'),
 enableMicrophone:()=>ipcRenderer.invoke('birdai-microphone-intent'),
 analyze:(pcm)=>{
  if(!(pcm instanceof Float32Array)||pcm.length!==160000)
   return Promise.reject(new Error('Нужны 5 секунд PCM при 32 кГц.'));
  return ipcRenderer.invoke('birdai-analyze',pcm);
 }
});
