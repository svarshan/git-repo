'use strict';
const {contextBridge,ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('MoOLVaMaps',{
  list:()=>ipcRenderer.invoke('maps:list'),
  download:id=>ipcRenderer.invoke('maps:download',id),
  pause:id=>ipcRenderer.invoke('maps:pause',id)
});
