'use strict';
const {app,BrowserWindow,shell,session,protocol,ipcMain}=require('electron');
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const {readMapRange}=require('./offline-map-file.cjs');
const regions=require('./map-regions.json');
const entry=path.join(__dirname,'index.html');
const entryUrl=pathToFileURL(entry).href;
protocol.registerSchemesAsPrivileged([{
 scheme:'moolva-map', privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true}
}]);
app.setAppUserModelId('ru.moolva.griby');
app.commandLine.appendSwitch('lang','ru-RU');
const evidenceFlag=process.argv.find(x=>x.startsWith('--moolva-evidence-dir='));
if(process.env.PORTABLE_EXECUTABLE_DIR && !app.commandLine.hasSwitch('user-data-dir')){
 const profile=path.join(process.env.PORTABLE_EXECUTABLE_DIR,'MoOLVa-Griby-Data');
 try {
  fs.mkdirSync(profile,{recursive:true});
  fs.accessSync(profile,fs.constants.W_OK);
  app.setPath('userData',profile);
 } catch {
  require('electron').dialog.showErrorBox('MoOLVa Грибы','Нет доступа для записи рядом с EXE. Перенесите программу в папку, где можно сохранять личные находки.');
  app.exit(1);process.exit(1);
 }
}
if(!evidenceFlag&&!app.requestSingleInstanceLock()){app.quit();process.exit(0);}
let win;
function createWindow(){
 win=new BrowserWindow({width:1420,height:920,minWidth:960,minHeight:680,autoHideMenuBar:true,show:false,backgroundColor:'#0a1512',
  icon:path.join(__dirname,'build','moolva-griby.ico'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
 win.webContents.setWindowOpenHandler(({url})=>{
  if(/^https:\/\/www\.google\.com\/maps\//.test(url)||/^https:\/\/(commons\.wikimedia\.org|www\.inaturalist\.org|www\.gbif\.org|github\.com|www\.poison\.org|www\.mediawiki\.org|www\.nn\.ru|nn\.aif\.ru|niann\.ru|www\.openstreetmap\.org|protomaps\.com)\//.test(url))shell.openExternal(url);
  return {action:'deny'};
 });
 win.webContents.on('will-navigate',(event,url)=>{if(url!==entryUrl)event.preventDefault();});
 win.loadFile(entry);
 win.once('ready-to-show',()=>win.show());
 if(evidenceFlag){
  const folder=evidenceFlag.slice('--moolva-evidence-dir='.length);
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
    const offline=await win.webContents.executeJavaScript(`(async()=>{
      const map=window.MoOLVaFreeMap32;
      const archive=await fetch('moolva-map://offline/nizhny-novgorod.pmtiles',{headers:{Range:'bytes=0-6'}});
      const signature=await archive.text();
      document.querySelector('#fm32-town').value='Семёнов';
      document.querySelector('#fm32-find').click();
      [...document.querySelectorAll('#fm32-results button')].find(button=>button.textContent.startsWith('Семёнов · город'))?.click();
      const center=map.getMap().getCenter();
      const hasGeography=x=>{
        const pixels=x.getContext('2d').getImageData(0,0,x.width,x.height).data;
        for(let i=4;i<pixels.length;i+=4)if(pixels[i]!==pixels[0]||pixels[i+1]!==pixels[1]||pixels[i+2]!==pixels[2])return true;
        return false;
      };
      let tiles=[],rendered=false;
      for(let i=0;i<50&&!rendered;i++){
        await new Promise(r=>setTimeout(r,100));
        tiles=[...document.querySelectorAll('#fm32-map canvas.leaflet-tile-loaded')].filter(x=>x.width&&x.height);
        rendered=tiles.some(hasGeography);
      }
      const packs=await window.MoOLVaMaps?.list();
      if(packs?.length!==6 || !packs.every(p=>p.state==='ready'))throw Error('Missing bundled map coverage');
      const header=await fetch('moolva-map://offline/nizhny-novgorod.pmtiles',{headers:{Range:'bytes=0-126'}});
      if(header.status!==206 || new Uint8Array(await header.arrayBuffer())[101]!==14)throw Error('Full detail map missing');
      return {status:archive.status,signature,rendered,tileCount:tiles.length,packCount:packs?.length||0,packPanelVisible:!document.getElementById('fm34-packs').hidden,semenov:center.lat>56.76&&center.lat<56.82&&center.lng>44.45&&center.lng<44.54,...map.getStatus()};
    })()`,true);
    fs.writeFileSync(path.join(folder,'09-offline-map.json'),JSON.stringify(offline,null,2));
    if(offline.status!==206||offline.signature!=='PMTiles'||!offline.rendered||!offline.semenov||offline.online||offline.localityCount<1000||offline.packCount!==6||!offline.packPanelVisible)
      throw Error('Offline map failed '+JSON.stringify(offline));
    fs.writeFileSync(path.join(folder,'07-free-interactive-map.png'),(await win.webContents.capturePage()).toPNG());
    fs.writeFileSync(path.join(folder,'08-visible-map-menu.png'),(await win.webContents.capturePage()).toPNG());
    clearTimeout(failure);app.exit(0);
   }catch(e){fs.writeFileSync(path.join(folder,'gui-error.txt'),String(e.stack||e));clearTimeout(failure);app.exit(3);}
  });
 }
}
app.whenReady().then(()=>{
 const ses=session.defaultSession;
 if(evidenceFlag)ses.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_details,callback)=>callback({cancel:true}));
 const mapFile=path.join(app.isPackaged ? process.resourcesPath : __dirname,'maps','nizhny-novgorod.pmtiles');
 ipcMain.handle('maps:list',(event)=>{
   const caller=event.senderFrame,top=event.sender.mainFrame;
   if(event.sender!==win?.webContents || !caller || !caller.url.startsWith('file:') || caller.routingId!==top.routingId || caller.processId!==top.processId) return [];
   return regions.map(region=>({...region,state:'ready'}));
 });
 protocol.handle('moolva-map',request=>{
   const url=new URL(request.url);
   if(url.host!=='offline'||url.pathname!=='/nizhny-novgorod.pmtiles'||url.search||request.method!=='GET')return new Response(null,{status:404});
   return readMapRange(mapFile,request.headers.get('Range'));
 });
 // OSM raster tile policy: app-identifying User-Agent and normal HTTP caching, no bulk fetching.
 ses.webRequest.onBeforeSendHeaders({urls:['https://tile.openstreetmap.org/*']},(details,callback)=>{
   details.requestHeaders['User-Agent']='MoOLVa-Griby/3.4 (+https://github.com/svarshan/git-repo)';
   callback({requestHeaders:details.requestHeaders});
 });
 createWindow();
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
