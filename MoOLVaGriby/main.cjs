'use strict';
const {app,BrowserWindow,shell}=require('electron');
const path=require('node:path');
const fs=require('node:fs');
app.setAppUserModelId('ru.moolva.griby');
if(!app.requestSingleInstanceLock()){app.quit();process.exit(0);}
let win;
function createWindow(){
 win=new BrowserWindow({width:1420,height:920,minWidth:960,minHeight:680,autoHideMenuBar:true,show:false,backgroundColor:'#0a1512',
  icon:path.join(__dirname,'build','moolva-griby.ico'),webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
 win.webContents.setWindowOpenHandler(({url})=>{
  if(/^https:\/\/(commons\.wikimedia\.org|www\.poison\.org|www\.mediawiki\.org)\//.test(url))shell.openExternal(url);
  return {action:'deny'};
 });
 win.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith('file://'))event.preventDefault();});
 win.loadFile(path.join(__dirname,'index.html'));
 win.once('ready-to-show',()=>win.show());
 const flag=process.argv.find(x=>x.startsWith('--moolva-evidence-dir='));
 if(flag){
  const folder=flag.slice('--moolva-evidence-dir='.length);
  const failure=setTimeout(()=>{fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,'gui-error.txt'),'Electron screenshot timed out');app.exit(2);},30000);
  win.webContents.once('did-finish-load',async()=>{
   try{
    await new Promise(resolve=>setTimeout(resolve,1400));
    fs.mkdirSync(folder,{recursive:true});
    const image=await win.webContents.capturePage();
    const out=path.join(folder,'01-glavnaya.png');
    fs.writeFileSync(out,image.toPNG());
    const checks=await win.webContents.executeJavaScript('({species:window.MOOLVA_MUSHROOMS?.length||0, cards:document.querySelectorAll(".mush-card").length, title:document.title})',true);
    fs.writeFileSync(path.join(folder,'gui-smoke.json'),JSON.stringify({...checks,screenshot:out},null,2));
    if(checks.species!==53||checks.cards<12)throw Error('Catalog failed GUI checks '+JSON.stringify(checks));
    clearTimeout(failure);app.exit(0);
   }catch(e){fs.writeFileSync(path.join(folder,'gui-error.txt'),String(e.stack||e));clearTimeout(failure);app.exit(3);}
  });
 }
}
app.whenReady().then(createWindow);
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
