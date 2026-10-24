'use strict';
const {app,BrowserWindow,shell,session}=require('electron');
const path=require('node:path');
function window(){
 const w=new BrowserWindow({title:'MoOLVa 4.0 — Птицы Нижегородской области',width:1440,height:900,minWidth:820,minHeight:580,backgroundColor:'#07101d',autoHideMenuBar:true,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
 w.webContents.on('will-navigate',e=>e.preventDefault());
 w.webContents.setWindowOpenHandler(({url})=>{try{const u=new URL(url);if(u.protocol==='https:'&&(/(^|\.)wikimedia\.org$|(^|\.)wikipedia\.org$/.test(u.hostname)))shell.openExternal(url);}catch{}return {action:'deny'};});
 w.loadFile(path.join(__dirname,'app','index.html'));
 return w;
}
app.whenReady().then(()=>{session.defaultSession.setPermissionRequestHandler((_wc,_p,done)=>done(false));window();app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)window();});});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});