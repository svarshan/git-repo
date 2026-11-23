'use strict';
const {contextBridge,ipcRenderer}=require('electron');

function collect(keys) {
  const values = {};
  for (const key of keys) {
    const value = localStorage.getItem(key);
    if (value !== null) values[key] = value;
  }
  return values;
}
contextBridge.exposeInMainWorld('MoOLVaMaps',{
  list:()=>ipcRenderer.invoke('maps:list')
});
contextBridge.exposeInMainWorld('MoOLVaReliability',{
  startup:()=>{
    const config = ipcRenderer.sendSync('profile:config');
    try {
      return {...ipcRenderer.sendSync('profile:bootstrap',collect(config.keys)),safe:config.safe};
    } catch {
      return {values:{},error:true,safe:config?.safe || false};
    }
  },
  snapshot:()=>{
    try {
      const {keys} = ipcRenderer.sendSync('profile:config');
      return ipcRenderer.sendSync('profile:snapshot',collect(keys));
    } catch {
      return false;
    }
  },
  restart:()=>ipcRenderer.send('profile:restart'),
  reloadAtlas:()=>ipcRenderer.send('profile:reload-atlas'),
  copyReport:()=>ipcRenderer.invoke('profile:copy-report')
});
