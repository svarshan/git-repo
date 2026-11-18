'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('MoOLVaMaps',{
  list:()=>ipcRenderer.invoke('maps:list')
});
