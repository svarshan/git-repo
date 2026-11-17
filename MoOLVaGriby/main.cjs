'use strict';
const {app,BrowserWindow,shell,session}=require('electron');
const path=require('node:path');
const fs=require('node:fs');
app.setAppUserModelId('ru.moolva.griby');
app.commandLine.appendSwitch('lang','ru-RU');
if(!app.requestSingleInstanceLock()){app.quit();process.exit(0);}
let win;
function createWindow(){
 win=new BrowserWindow({width:1420,height:920,minWidth:960,minHeight:680,autoHideMenuBar:true,show:false,backgroundColor:'#0a1512',
  icon:path.join(__dirname,'build','moolva-griby.ico'),webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
 win.webContents.setWindowOpenHandler(({url})=>{
  if(/^https:\/\/www\.google\.com\/maps\//.test(url)||/^https:\/\/(commons\.wikimedia\.org|www\.inaturalist\.org|www\.gbif\.org|github\.com|www\.poison\.org|www\.mediawiki\.org|www\.nn\.ru|nn\.aif\.ru|niann\.ru|www\.openstreetmap\.org)\//.test(url))shell.openExternal(url);
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
    const checks=await win.webContents.executeJavaScript('({species:window.MOOLVA_MUSHROOMS?.length||0, cards:document.querySelectorAll(".mush-card").length,features:!!window.MoOLVa20, title:document.title})',true);
    fs.writeFileSync(path.join(folder,'gui-smoke.json'),JSON.stringify({...checks,screenshot:out},null,2));
    if(checks.species<53||checks.cards<12||!checks.features)throw Error('Catalog failed GUI checks '+JSON.stringify(checks));
    const staticNav=await win.webContents.executeJavaScript(`(()=>{
      const btn=document.querySelector('#primary-map-nav');
      const page=document.querySelector('main > #expedition30');
      const rect=btn?.getBoundingClientRect();
      return {buttonExists:!!btn, buttonLabel:btn?.textContent.trim()||'', mapPageExists:!!page,
        displayed:!!btn && !!rect && rect.width>30 && rect.height>18 && rect.top>=0 && rect.bottom<=window.innerHeight,
        secondInNav:btn?.parentElement?.querySelectorAll('button')?.[1]===btn};
    })()`,true);
    fs.writeFileSync(path.join(folder,'08-static-menu-check.json'),JSON.stringify(staticNav,null,2));
    if(!staticNav.buttonExists||!staticNav.mapPageExists||!staticNav.displayed||!staticNav.secondInNav||!staticNav.buttonLabel.includes('Карта грибных мест'))
      throw Error('Main map menu is missing or invisible '+JSON.stringify(staticNav));
    for(const [name,target] of [['02-opredelitel.png','id20'],['03-karta-nablyudenii.png','geo20'],['04-foto-pomoshchnik.png','photo20']]){
      await win.webContents.executeJavaScript('document.querySelector('+JSON.stringify('[data-stage20="'+target+'"]')+').click()');
      await new Promise(r=>setTimeout(r,200));
      fs.writeFileSync(path.join(folder,name),(await win.webContents.capturePage()).toPNG());
    }
    await win.webContents.executeJavaScript("document.querySelector('#primary-map-nav').click()");
    await new Promise(r=>setTimeout(r,250));
    fs.writeFileSync(path.join(folder,'05-expedition.png'),(await win.webContents.capturePage()).toPNG());
    const expedition=await win.webContents.executeJavaScript("({shown:document.querySelector('#expedition30')?.classList.contains('active'),reports:window.MoOLVaExpedition30?.reportData?.length||0,pins:document.querySelectorAll('#exp-map-pins .exp-pin').length})",true);
    fs.writeFileSync(path.join(folder,'expedition-smoke.json'),JSON.stringify(expedition,null,2));
    if(!expedition.shown||expedition.reports<10||expedition.pins<10)throw Error('Expedition map failed GUI checks '+JSON.stringify(expedition));
    const googleChecks=await win.webContents.executeJavaScript("({panel:!!document.querySelector('#gm31-panel'),url:window.MoOLVaGoogle31Core?.googleUrl(56.35,43.60)||'',hasPrivateLink:!!document.querySelector('#gm31-google-selected')})",true);
    fs.writeFileSync(path.join(folder,'google31-smoke.json'),JSON.stringify(googleChecks,null,2));
    if(!googleChecks.panel||!googleChecks.hasPrivateLink||!googleChecks.url.startsWith('https://www.google.com/maps/search/?api=1'))throw Error('Google Maps integration failed '+JSON.stringify(googleChecks));
    fs.writeFileSync(path.join(folder,'06-google-maps.png'),(await win.webContents.capturePage()).toPNG());
    const freeMap=await win.webContents.executeJavaScript(`(async()=>{document.querySelector('#primary-map-nav').click(); await new Promise(r=>setTimeout(r,800)); const api=window.MoOLVaFreeMap32; const map=api?.getMap?.(); const before=map?.getZoom()||0; const btnIn=document.querySelector('#fm32-map .leaflet-control-zoom-in'); const btnOut=document.querySelector('#fm32-map .leaflet-control-zoom-out'); const waitZoom=async(btn)=>{if(!map||!btn)return; const done=new Promise(resolve=>{map.once('zoomend',resolve);setTimeout(resolve,1400);});btn.click();await done;}; await waitZoom(btnIn); const after=map?.getZoom()||0; await waitZoom(btnOut); const afterOut=map?.getZoom()||0; return {leaflet:!!window.L, mapReady:!!map, before, after, afterOut, ...api?.getStatus?.(), townLabelsLayer:!!document.querySelector('#fm32-map .leaflet-tile-pane'), attribution:!!document.querySelector('#fm32-map .leaflet-control-attribution')};})()`,true);
    const mapByMenu=await win.webContents.executeJavaScript(`({
      pageActive:document.querySelector('#expedition30')?.classList.contains('active'),
      navSelected:document.querySelector('#primary-map-nav')?.classList.contains('selected'),
      mapCanvasDisplayed:(()=>{const e=document.querySelector('#fm32-map');return !!e&&!e.hidden&&e.getBoundingClientRect().width>100;})()
    })`,true);
    fs.writeFileSync(path.join(folder,'08-static-navigation.json'),JSON.stringify(mapByMenu,null,2));
    if(!mapByMenu.pageActive||!mapByMenu.navSelected||!mapByMenu.mapCanvasDisplayed)
      throw Error('Visible main map menu cannot open Leaflet '+JSON.stringify(mapByMenu));
    fs.writeFileSync(path.join(folder,'free-map32-smoke.json'),JSON.stringify(freeMap,null,2));
    if(!freeMap.leaflet||!freeMap.mapReady||freeMap.after!==freeMap.before+1||freeMap.afterOut!==freeMap.before||!freeMap.townLabelsLayer||!freeMap.attribution||freeMap.markerCount<10)
      throw Error('Leaflet map or zoom failed '+JSON.stringify(freeMap));
    fs.writeFileSync(path.join(folder,'07-free-interactive-map.png'),(await win.webContents.capturePage()).toPNG());
    fs.writeFileSync(path.join(folder,'08-visible-map-menu.png'),(await win.webContents.capturePage()).toPNG());
    clearTimeout(failure);app.exit(0);
   }catch(e){fs.writeFileSync(path.join(folder,'gui-error.txt'),String(e.stack||e));clearTimeout(failure);app.exit(3);}
  });
 }
}
app.whenReady().then(()=>{
 const ses=session.defaultSession;
 // OSM raster tile policy: app-identifying User-Agent and normal HTTP caching, no bulk fetching.
 ses.webRequest.onBeforeSendHeaders({urls:['https://tile.openstreetmap.org/*']},(details,callback)=>{
   details.requestHeaders['User-Agent']='MoOLVa-Griby/3.3 (+https://github.com/svarshan/git-repo)';
   callback({requestHeaders:details.requestHeaders});
 });
 createWindow();
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
